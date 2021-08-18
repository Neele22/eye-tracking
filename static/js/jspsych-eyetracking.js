jsPsych.plugins['eye-tracking'] = (function(){
    // ============== global variables ================ //
    var PointCalibrate = 0;
    var CalibrationPoints={};
    var trial_data = {};
    var n_cal = 0; // number of calibrations already tried

    // ============== helper functions ================ //

    /**
     * Gets browser type
     * ! Warning: browser details very unreliable, can be changed or hidden by user and browser
     */
    function checkBrowser() {

      // check browser (unreliable!)
      const { userAgent } = navigator

      if (userAgent.includes('Firefox/')) {
        trial_data['browser'] = 'Firefox';
      } else if (userAgent.includes('Edg/')) {
        trial_data['browser'] = 'Edge';
      } else if (userAgent.includes('Chrome/')) {
        trial_data['browser'] = 'Chrome';
      } else if (userAgent.includes('Safari/')) {
        trial_data['browser'] = 'Safari';
      } else {
        trial_data['browser'] = 'unknown';
      }
    }

    /**
    * Starts webgazer, prediction points, and video feedback.
    */
    async function StartWebgazer(){
      webgazer.params.showVideoPreview = true;
      //start the webgazer tracker
      await webgazer.setRegression('ridge') /* currently must set regression and tracker */
          .setGazeListener(function(data, clock) {
            //   console.log(data); /* data is an object containing an x and y key which are the x and y prediction coordinates (no bounds limiting) */
            //   console.log(clock); /* elapsed time in milliseconds since webgazer.begin() was called */
          }).begin();
          webgazer.showVideoPreview(true) /* shows all video previews */
              .showPredictionPoints(true) /* shows a square every 100 milliseconds where current prediction is */
              .applyKalmanFilter(true); /* Kalman Filter on.  */
  
      //Set up the webgazer video feedback.
      var setup = function() {
          //Set up the main canvas. The main canvas is used to calibrate the webgazer.
          var jspsych_content = document.getElementById("jspsych-content");
          jspsych_content.classList.add("eye-content"); // add styled class to prevent canvas from being transformed
          var canvas = document.getElementById("plotting_canvas");
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          canvas.style.position = 'fixed';
          canvas.style.top = 0;
          canvas.style.left = 0;
      };
      setup();
    }

    /**
    * Sets store_points to true, so all the occuring prediction points are stored.
    */
    function store_points_variable(){
      webgazer.params.storingPoints = true;
    }

    /**
    * Sets store_points to false, so prediction points aren't stored anymore.
    */
    function stop_storing_points_variable(){
      webgazer.params.storingPoints = false;
    }

    /**
    * This function calculates a measurement for how precise 
    * the eye tracker currently is which is displayed to the user
    */
    function calculatePrecision(past50Array, maxDistance) {
      var windowHeight = $(window).height();
      var windowWidth = $(window).width();

      // Retrieve the last 50 gaze prediction points
      var x50 = past50Array[0];
      var y50 = past50Array[1];

      // Calculate the position of the point the user is staring at
      var staringPointX = windowWidth / 2;
      var staringPointY = windowHeight / 2;

      trial_data['validation_point'] = {
        'x': staringPointX,
        'y': staringPointY
      }

      // var precisionPercentages = new Array(50);
      // calculatePrecisionPercentages(precisionPercentages, windowHeight, x50, y50, staringPointX, staringPointY);
      // var precision = calculateAverage(precisionPercentages);

      // calculate accuracy
      var precision = calculateAccuracy(x50, y50, staringPointX, staringPointY, maxDistance);

      // Return the precision measurement as a rounded percentage
      return Math.round(precision);
    };

    /**
    * Calculates accuracy based on distance prediciton points from middle point
    */
    function calculateAccuracy(x50, y50, staringPointX, staringPointY, maxDistance) {
      // variables
      var precisePoints = 0;
      var validationData = [];

      for (x = 0; x < 50; x++) {
        // Calculate distance between each prediction and staring point
        var xDiff = staringPointX - x50[x];
        var yDiff = staringPointY - y50[x];
        var distance = Math.sqrt((xDiff * xDiff) + (yDiff * yDiff));

        validationData.push({
          'x': x50[x],
          'y': y50[x],
          'distance in px': distance
        });

        if (distance < maxDistance) { // max distance from staring point as specified by user
          precisePoints += 1;
        }
      }

      trial_data['validation_data'] = validationData;

      // calculate percentage of points that were inside the maxDistance range
      var precision = (precisePoints / 50) * 100;

      return precision;
    }

    /**
    * Calculate percentage accuracy for each prediction based on distance of
    * the prediction point from the centre point (uses the window height as
    * lower threshold 0%).
    */
    function calculatePrecisionPercentages(precisionPercentages, windowHeight, x50, y50, staringPointX, staringPointY) {
      for (x = 0; x < 50; x++) {
        // Calculate distance between each prediction and staring point
        var xDiff = staringPointX - x50[x];
        var yDiff = staringPointY - y50[x];
        var distance = Math.sqrt((xDiff * xDiff) + (yDiff * yDiff));

        // Calculate precision percentage
        var halfWindowHeight = windowHeight / 2;
        var precision = 0;
        if (distance <= halfWindowHeight && distance > -1) {
          precision = 100 - (distance / halfWindowHeight * 100);
        } else if (distance > halfWindowHeight) {
          precision = 0;
        } else if (distance > -1) {
          precision = 100;
        }

        // Store the precision
        precisionPercentages[x] = precision;
      }
    }

    /**
    * Calculates the average of all precision percentages calculated.
    */
    function calculateAverage(precisionPercentages) {
      var precision = 0;
      for (x = 0; x < 50; x++) {
        precision += precisionPercentages[x];
      }
      precision = precision / 50;
      return precision;
    }

    /**
    * Clear the canvas and the calibration button.
    */
    function ClearCanvas(){
      $(".Calibration").hide();
      var canvas = document.getElementById("plotting_canvas");
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }

    /**
     * Show the instruction of using calibration at the start up screen.
     */
    function PopUpInstruction(){
      ClearCanvas();
      swal({
        title:"Calibration",
        text: "Please click on each of the 9 points on the screen. You must click on each point 5 times till it goes yellow. This will calibrate your eye movements.",
        buttons:{
          cancel: false,
          confirm: true
        }
      }).then(isConfirm => {
        if(!isFullscreen()) {
          launchIntoFullscreen(document.documentElement);
        }
        ShowCalibrationPoint();
      });
    }

    /**
    * Load this function when the calibration plugin is loaded.
    * This function listens for button clicks on the html page,
    * checks that all buttons have been clicked 5 times each, and then goes on to measuring the precision
    * @param {Int} minAcc 
    * @param {Bool} vidOn
    * @param {Bool} predOn
    */
    function StartCalibration(maxDistance, minAcc, vidOn, predOn, valTrial, nCal){
      PopUpInstruction();

      ClearCanvas();
      ShowCalibrationPoint();

      $(".Calibration").click(function(){ // click event on the calibration buttons

        var id = $(this).attr('id');

        if (!CalibrationPoints[id]){ // initialises if not done
          CalibrationPoints[id]=0;
        }
        CalibrationPoints[id]++; // increments values

        if (CalibrationPoints[id]==5){ //only turn to yellow after 5 clicks
          $(this).css('background-color','yellow');
          $(this).prop('disabled', true); //disables the button
          PointCalibrate++;
        } else if (CalibrationPoints[id]<5){
          //Gradually increase the opacity of calibration points when click to give some indication to user.
          var opacity = 0.2*CalibrationPoints[id]+0.2;
          $(this).css('opacity',opacity);
        }

        //Show the middle calibration point after all other points have been clicked.
        if (PointCalibrate == 8){
          $("#Pt5").show();
        }

        if (PointCalibrate >= 9){ // last point is calibrated
          // clears the canvas
          runValidation(maxDistance, minAcc, vidOn, predOn, valTrial, nCal);
        }
      });
    }

    /**
     * Calculates validation of calibration
     * @param {Int} minAcc 
     * @param {Bool} vidOn
     * @param {Bool} predOn
     */
    function runValidation(maxDistance, minAcc, vidOn, predOn, valTrial, nCal) {
      ClearCanvas();

      $("#Pt10").show();

      // notification for the measurement process
      swal({
        title: "Calculating measurement",
        text: "Please click once on and then stare at the middle dot for the next 5 seconds. This will allow us to calculate the accuracy of our predictions.",
        closeOnEsc: false,
        allowOutsideClick: false,
        closeModal: true
      }).then(isConfirm => {
        if (isConfirm) {

          $("#Pt10").click(function(){

            // makes the variables true for 5 seconds & plots the points
            // $(document).ready(function(){

              store_points_variable(); // start storing the prediction points

              sleep(5000).then(() => {
                stop_storing_points_variable(); // stop storing the prediction points
                var past50 = webgazer.getStoredPoints(); // retrieve the stored points
                var precision_measurement = calculatePrecision(past50, maxDistance);
                trial_data['cal_accuracy'] = precision_measurement;
                n_cal = n_cal + 1;
                $("#Pt10").hide();

                if ((precision_measurement < minAcc) && (n_cal < nCal) && (valTrial == false)) { // maximum number of cals = nCal, only when in cal+val trial
                  swal({
                    title: "Your accuracy measure is " + precision_measurement + "%.",
                    text: "This is too low, so you need to recalibrate.",
                    allowOutsideClick: false,
                    buttons: {
                      confirm: {
                        text: "Recalibrate",
                        value: true
                      }
                    }
                  }).then(isConfirm => {
                    if (isConfirm) {
                      webgazer.clearData();
                      ClearCalibration();
                      ClearCanvas();
                      ShowCalibrationPoint();
                    }
                  });
                } else {
                  trial_data['n_cals'] = n_cal;
                  n_cal = 0;
                  swal({
                    title: "Your accuracy measure is " + precision_measurement + "%",
                    allowOutsideClick: false,
                    buttons: {
                      cancel: {
                        text: "Recalibrate",
                        value: !valTrial // only show this option when in a cal + val trial
                      },
                      confirm: {
                        text: "Continue to trial",
                        value: true,
                        className: "end_cal_jspsych"
                      }
                    }
                  }).then(isConfirm => {
                    if (isConfirm){
                      //clear the calibration & hide the last middle button
                      ClearCanvas();

                      // show or hide video previews and predictions
                      webgazer.showVideoPreview(vidOn)
                        .showPredictionPoints(predOn)
                      
                      // remove eye-content class from jspsych_content to reset resizing
                      var jspsych_content = document.getElementById("jspsych-content");
                      jspsych_content.classList.remove("eye-content");

                      // end trial
                      jsPsych.finishTrial(trial_data);
                    } else {
                      //use restart function to restart the calibration
                      webgazer.clearData();
                      ClearCalibration();
                      ClearCanvas();
                      ShowCalibrationPoint();
                    }
                  });
                }
              });
            // });
          
          });
        }
      });
    }

    /**
    * Show the Calibration Points
    */
    function ShowCalibrationPoint() {
      $(".Calibration").show();
      $("#Pt5").hide(); // initially hides the middle button
    }

    /**
    * This function clears the calibration buttons memory
    */
    function ClearCalibration(){
      // Clear data from WebGazer

      $(".Calibration").css('background-color','red');
      $(".Calibration").css('opacity',0.2);
      $(".Calibration").prop('disabled',false);

      CalibrationPoints = {};
      PointCalibrate = 0;
    }

    /** 
    * sleep function because js doesn't have one, sourced from http://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
    */
    function sleep (time) {
      return new Promise((resolve) => setTimeout(resolve, time));
    }

    /**
     * Check to see whether screen is full screen
     */
    function isFullscreen(){
      return (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    }

    /**
     * launch element into fullscreen
     * @param {*} element a DOM element, for example document.documentElement
     */
    function launchIntoFullscreen(element){
      if(element.requestFullscreen) {
        element.requestFullscreen();
      } else if(element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if(element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if(element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
    }

    // ==============plugin============== //
    var plugin = {};
  
    plugin.info = {
      name: 'eye-tracking',
      parameters: {
        validation: { // if true: only validation, no calibration
          type: jsPsych.plugins.parameterType.BOOL,
          default: false
        },
        maximumDistance: { // max distance (in px) for prediction points from actual point
          type: jsPsych.plugins.parameterType.INT,
          default: 100          
        },
        minimumAccuracy: { // minimum accuracy to pass calibration
          type: jsPsych.plugins.parameterType.INT,
          default: 50
        },
        nCal: { // number of calibrations before automatic continuation
          type: jsPsych.plugins.parameterType.INT,
          default: 3
        },
        videoOn: { // if true: leave video on after calibration
          type: jsPsych.plugins.parameterType.BOOL,
          default: false
        },
        predictionOn: { // if true: leave points prediction on after calibration
          type: jsPsych.plugins.parameterType.BOOL,
          default: false
        }
      }
    }

    var dots = `
    <canvas id="plotting_canvas" width="500" height="500" style="cursor:crosshair;"></canvas>
    <div class="calibrationDiv">
      <input type="button" class="Calibration" id="Pt1"></input>
      <input type="button" class="Calibration" id="Pt2"></input>
      <input type="button" class="Calibration" id="Pt3"></input>
      <input type="button" class="Calibration" id="Pt4"></input>
      <input type="button" class="Calibration" id="Pt5"></input>
      <input type="button" class="Calibration" id="Pt6"></input>
      <input type="button" class="Calibration" id="Pt7"></input>
      <input type="button" class="Calibration" id="Pt8"></input>
      <input type="button" class="Calibration" id="Pt9"></input>
      <input type="button" class="Validation" id="Pt10"></input>
    </div>
    `;          

    plugin.trial = function(display_element, trial){
      // changing display
      display_element.innerHTML = dots;

      // checking browser type
      checkBrowser();

      // check if webgazer has previously started, else: start it (how??)
      webgazer.clearData();
      ClearCalibration();
      ClearCanvas();
      ShowCalibrationPoint();
      StartWebgazer();

      if (trial.validation == true) {
        // only validation
        trial_data['type'] = 'validation';
        runValidation(trial.maximumDistance, trial.minimumAccuracy, trial.videoOn, trial.predictionOn, trial.validation, trial.nCal);
      } else {
        // calibration and validation
        trial_data['type'] = 'calibration';
        StartCalibration(trial.maximumDistance, trial.minimumAccuracy, trial.videoOn, trial.predictionOn, trial.validation, trial.nCal);
      }

      // closing webgazer when window is closed
      window.onbeforeunload = function() {
        webgazer.end();
      }
    }
  
    return plugin;
  
  })();

// global functions

/**
* Resumes collection of eye data (x and y coordinates of prediction).
* @returns Array where 0 = object of x and y coordinates and time elapsed since start,
* and 1 = interval object making the predictions
*/
function collectEyeData() {
  webgazer.resume();
  var eyeData = [];
  var starttime = performance.now();
  var eyeInterval = setInterval(
      function() {
          webgazer.getCurrentPrediction()
              .then((pos) => {
                  eyeData.push({
                      'x': pos.x,
                      'y': pos.y,
                      'time_elapsed': performance.now() - starttime // in ms
                  });
              });
      },
      1 // number of ms per which to execute setInterval
    )
  return [eyeData, eyeInterval];
}