jsPsych.plugins['eye-tracking'] = (function(){
    // ============== global variables ================ //
    var PointCalibrate = 0;
    var CalibrationPoints={};

    // ============== helper functions ================ //
    async function StartWebgazer(){
      webgazer.params.showVideoPreview = true;
      //start the webgazer tracker
      await webgazer.setRegression('ridge') /* currently must set regression and tracker */
          //.setTracker('clmtrackr')
          .setGazeListener(function(data, clock) {
            //   console.log(data); /* data is an object containing an x and y key which are the x and y prediction coordinates (no bounds limiting) */
            //   console.log(clock); /* elapsed time in milliseconds since webgazer.begin() was called */
          }).begin();
          webgazer.showVideoPreview(true) /* shows all video previews */
              .showPredictionPoints(true) /* shows a square every 100 milliseconds where current prediction is */
              .applyKalmanFilter(true); /* Kalman Filter defaults to on.  */
  
      //Set up the webgazer video feedback.
      var setup = function() {
  
          //Set up the main canvas. The main canvas is used to calibrate the webgazer.
          var canvas = document.getElementById("plotting_canvas");
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          canvas.style.position = 'fixed';
          canvas.style.top = 0;
          canvas.style.left = 0;
      };
      setup();
    }

    /*
    * Sets store_points to true, so all the occuring prediction
    * points are stored
    */
    function store_points_variable(){
      webgazer.params.storingPoints = true;
    }

    /*
    * Sets store_points to false, so prediction points aren't
    * stored any more
    */
    function stop_storing_points_variable(){
      webgazer.params.storingPoints = false;
    }

    /*
    * This function calculates a measurement for how precise 
    * the eye tracker currently is which is displayed to the user
    */
    function calculatePrecision(past50Array) {
      var windowHeight = $(window).height();
      var windowWidth = $(window).width();

      // Retrieve the last 50 gaze prediction points
      var x50 = past50Array[0];
      var y50 = past50Array[1];

      // Calculate the position of the point the user is staring at
      var staringPointX = windowWidth / 2;
      var staringPointY = windowHeight / 2;

      var precisionPercentages = new Array(50);
      calculatePrecisionPercentages(precisionPercentages, windowHeight, x50, y50, staringPointX, staringPointY);
      var precision = calculateAverage(precisionPercentages);

      // Return the precision measurement as a rounded percentage
      return Math.round(precision);
    };

    /*
    * Calculate percentage accuracy for each prediction based on distance of
    * the prediction point from the centre point (uses the window height as
    * lower threshold 0%)
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

    /*
    * Calculates the average of all precision percentages calculated
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
        ShowCalibrationPoint();
      });
    }

    /**
    * Load this function when the calibration plugin is loaded
    * This function listens for button clicks on the html page
    * checks that all buttons have been clicked 5 times each, and then goes on to measuring the precision
    */
    function StartCalibration(minAcc, data){
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
            ClearCanvas();

            $("#Pt5").show();

            // notification for the measurement process
            swal({
              title: "Calculating measurement",
              text: "Please don't move your mouse & stare at the middle dot for the next 5 seconds. This will allow us to calculate the accuracy of our predictions.",
              closeOnEsc: false,
              allowOutsideClick: false,
              closeModal: true
            }).then( isConfirm => {

                // makes the variables true for 5 seconds & plots the points
                $(document).ready(function(){

                  store_points_variable(); // start storing the prediction points

                  sleep(5000).then(() => {
                      stop_storing_points_variable(); // stop storing the prediction points
                      var past50 = webgazer.getStoredPoints(); // retrieve the stored points
                      var precision_measurement = calculatePrecision(past50);
                      data['accuracy'] = precision_measurement;

                      if (precision_measurement < minAcc) {
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
                        swal({
                          title: "Your accuracy measure is " + precision_measurement + "%",
                          allowOutsideClick: false,
                          buttons: {
                            cancel: "Recalibrate",
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
                              webgazer.showVideoPreview(false) /* shows all video previews */
                                  .showPredictionPoints(false) /* shows a square every 100 milliseconds where current prediction is */
                                  .applyKalmanFilter(false); /* Kalman Filter defaults to on.  */                
                              jsPsych.finishTrial();
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
                });
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

    // sleep function because js doesn't have one, sourced from http://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
    function sleep (time) {
      return new Promise((resolve) => setTimeout(resolve, time));
    }

    // ==============plugin============== //
    var plugin = {};
  
    plugin.info = {
      name: 'eye-tracking',
      parameters: {
        minimumAccuracy: {
          type: jsPsych.plugins.parameterType.INT,
          default: 50
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
    </div>
    `;

    plugin.trial = function(display_element, trial){
      // saving data
      var trial_data = {
      };

      // changing display
      display_element.innerHTML = dots;

      // starting calibration
      StartWebgazer();
      StartCalibration(trial.minimumAccuracy, trial_data);

      // closing webgazer when window is closed
      window.onbeforeunload = function() {
        webgazer.end();
      }
    }
  
    return plugin;
  
  })();