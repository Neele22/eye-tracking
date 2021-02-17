import gorilla = require("gorilla/gorilla");

// Make sure to upload the jsPsych files you need to the resources tab.
// This should include the main jsPsych.js, jsPsych.css and likely at least one plugin. 
// In this case, we use the jspsych-html-keyboard-response.js plugin file.
var jsPsych = window['jsPsych'];

gorilla.ready(function(){
    /* global variables */
    var eye_data;
    var eye_tracking_interval;
    
    /* enter fullscreen mode */
    timeline.push({
      type: 'fullscreen',
      fullscreen_mode: true
    });

    /* define card calibration trial. This will automatically be used to scale
    the stimuli in the rest of the experiment */
    var inputs = {
      type: 'resize',
      item_width: 8.56,
      item_height: 5.397,
      prompt: "<p>Click and drag the lower right corner of the box until the"+
      " box is the same size as a credit card held up to the screen.</p>",
      pixels_per_unit: 50 /* 50 pixels equals 1 cm */
    };
    timeline.push(inputs);
    
    /* ========================== START SCREENS ========================== */
    /* create empty timeline */
    var timeline = [];

    /* ======================== TASK INSTRUCTIONS ======================== */
    var instr = {
        type: 'instructions',
        pages: [
            "<p>In this task, a black circle will appear in the center "+
            "of the screen. Please look at the circle at all times.</p>",

            "A red dot will apear above or below the center, "+
            "followed by a blue dot.",

            "<p>If the blue dot is <strong>above</strong> the red dot, "+
            "press the letter 'Y' on the keyboard with your right index finger.<p>"+
            "<p>If the blue dot is <strong>below</strong> the red dot, "+
            "press the letter 'B' on the keyboard with your left index finger.</p>",

            "<p>You will receive feedback after each trial.<p>"+
            "<p>Press any key to continue to the next trial.</p>",

            "<p>You will start with some practice trials.</p>"+
            "<p>Click next to start.</p>"
        ],
        show_clickable_nav: true
    }
    timeline.push(instr);

    /* ============================= STIMULI ============================= */
    /* Screen size
    Minimum screen size  14” (31.0 * 17.4 cm)
    Canvas               30 * 17 cm
    Canvas               1500 * 850 pixels                                 */

    /* Visual degrees to pixels (viewing distance is set at 51 cm)
    Website: https://www.sr-research.com/visual-angle-calculator/

                                  CM      pixels	   visual degrees
    pixels_per_unit	              1	      50
    Canvas X	                    30	    1500
    Canvas Y 	                    17	    850
    Target diameter		                    13.35	      0.3
    Fixation diameter		                  13.35	      0.3
    Fixation largest diameter		          66.76	      1.5
    Start distance		                    213.75	    4.8
    constant                              160.27      3.6
    One visual degree		                  44.51	      1
    Distance to screen edge and fixation 	53.41	      1.2
    Minimum distance between targets		  4.45	      0.1
    Maximum distance between targets			284.8	      6.39
    [Half screen - (0.5 * fixation) - distance edge - distance fixation] */

    /* draw the fixation point */
    function drawFix(c){
      var ctx = c.getContext('2d');
      var xCenter = 1500/2;
      var yCenter = 850/2;
      var fixSize = jsPsych.timelineVariable('fixSize', true);
      var fixThick = 3;

      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(xCenter, yCenter, (fixSize/2), 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "white";
      /* fillRect(x-upperleft, y-upperleft, width, height)*/
      ctx.fillRect(xCenter-(fixSize/2), yCenter-(fixThick/2), fixSize, fixThick);
      ctx.fillRect(xCenter-(fixThick/2), yCenter-(fixSize/2), fixThick, fixSize);
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(xCenter, yCenter, fixThick/3, 0, 2 * Math.PI);
      ctx.fill();
    }

    /* define the screen that shows the first fixation */
    var fixation1 = {
      type: 'canvas-keyboard-response',
      canvas_size: [850, 1500], /* [height, width] */
      stimulus: drawFix,
      choices: jsPsych.NO_KEYS,
      trial_duration: function(){
        return jsPsych.randomization.sampleWithoutReplacement([800, 850, 900, 950, 1000], 1)[0];
      },
      data: {test_part: 'fixation1', procedure: jsPsych.timelineVariable('prac')},

      /* apply staircase and set the distance between target 1 and target 2 */
      on_finish: function(data){

        /* retrieve all trials and get the current trial number */
        var trials = jsPsych.data.getLastTimelineData().filter({test_part: 'fixation1'});
        data.nCurTrial = trials.count();

        /* retrieve the distance and response from the previous trial */
        if(data.nCurTrial > 1){
          var prev_trial_dist = jsPsych.data.getLastTimelineData().filter({test_part: 'fixation1'}).last(2).values()[0].dist;
          data.prev_trial_correct = jsPsych.data.getLastTimelineData().filter({test_part: 'target2'}).last(1).values()[0].correct;
          var constant = 160.27; /* the constant is set to 3.6 degrees */
        }

        /* set distance for the current trial baed on the staircase */
        if(data.nCurTrial == 1){
          var dist = 213.75;
          data.nSwitches = 0;
        } else if(data.nCurTrial > 1 && data.nCurTrial < 5){
          var dist = prev_trial_dist - (constant / (data.nCurTrial-1)) * (data.prev_trial_correct - 0.8);
          data.nSwitches = 0;
        } else if(data.nCurTrial > 4){
          data.prev_switchTrial = jsPsych.data.getLastTimelineData().filter({test_part: 'target2'}).last(1).values()[0].switchTrial;
          data.nSwitches = jsPsych.data.getLastTimelineData().filter({test_part: 'fixation1'}).last(2).values()[0].nSwitches + data.prev_switchTrial;
          var dist = prev_trial_dist - (constant / (2 + data.nSwitches)) * (data.prev_trial_correct - 0.8);
        }

        /* make sure the distance is never too small or too large */
        var maxDist = 284.8;
        var minDist = 4.45;
        if(dist > maxDist){
          data.dist = maxDist;
        } else if(dist < minDist){
          data.dist = minDist;
        } else{
          data.dist = dist;
        }

        /* set Y-location for Target 1 for the current trial by computing the
        lower and upper borders (i.e. there should be enough room for Target 2) */
        var tarHalf = jsPsych.timelineVariable('tarHalf', true);
        var tarAbove = jsPsych.timelineVariable('tarAbove', true);
        var fixSize = jsPsych.timelineVariable('fixSize', true);
        var fixThick = 3;
        var tarSize = 13.35;
        var xCenter = 1500/2;
        var yCenter = 850/2;
        var distEdge = 53.41;

        /* if target 2 is above target 1 */
        if(tarAbove == -1){
          /* if targets appear in the upper half */
          if(tarHalf == -1){
            var lowBorder = 0 + distEdge + data.dist;
            var upBorder = yCenter - (0.5 * fixSize) - distEdge;
          /* if targets appear in the lower half */
          } else if(tarHalf == 1){
            var lowBorder = yCenter + (0.5 * fixSize) + distEdge + data.dist;
            var upBorder = (yCenter * 2) - distEdge;
          }
        /* if target 2 is below target 1*/
        } else if (tarAbove == 1){
          /* if targets appear in the upper half */
          if(tarHalf == -1){
            var lowBorder = 0 + distEdge;
            var upBorder = yCenter - (0.5 * fixSize) - distEdge - data.dist;
          /* if targets appear in the lower half */
          } else if(tarHalf == 1){
            var lowBorder = yCenter + (0.5 * fixSize) + distEdge;
            var upBorder = (yCenter * 2) - distEdge - data.dist;
          }
        }

        /* pick a random location in between the lower and upper borders */
        var range = (upBorder - lowBorder) + 1;
        data.tar1Y = (Math.random() * range) + lowBorder;
        }
    }

    /* draw the fixation point + Target 1 */
    function drawTar1(c){
      var ctx = c.getContext('2d');
      var tarAbove = jsPsych.timelineVariable('tarAbove', true);
      var fixSize = jsPsych.timelineVariable('fixSize', true);
      var fixThick = 3;
      var tarSize = 13.35;
      var xCenter = 1500/2;
      var yCenter = 850/2;
      var tar1Y = jsPsych.data.getLastTimelineData().filter({test_part: 'fixation1'}).last(1).values()[0].tar1Y;

      /* Fixation */
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(xCenter, yCenter, (fixSize/2), 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.fillRect(xCenter-(fixSize/2), yCenter-(fixThick/2), fixSize, fixThick);
      ctx.fillRect(xCenter-(fixThick/2), yCenter-(fixSize/2), fixThick, fixSize);
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(xCenter, yCenter, fixThick/3, 0, 2 * Math.PI);
      ctx.fill();

      /* Target 1 */
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(xCenter, tar1Y, tarSize/2, 0, 2 * Math.PI);
      ctx.fill();
    }

    /* define the screen that shows Target 1 */
    var target1 = {
      type: 'canvas-keyboard-response',
      canvas_size: [850, 1500],
      stimulus: drawTar1,
      choices: jsPsych.NO_KEYS,
      trial_duration: 500,
      data: {test_part: 'target1', procedure: jsPsych.timelineVariable('prac')}
    }

    /* define the screen that shows the second fixation */
    var fixation2 = {
      type: 'canvas-keyboard-response',
      canvas_size: [850, 1500],
      stimulus: drawFix,
      choices: jsPsych.NO_KEYS,
      trial_duration: 2000,
      data: {test_part: 'fixation2', procedure: jsPsych.timelineVariable('prac')}
    }

   /* draw the fixation point + Target 2 */
    function drawTar2(c){
      var ctx = c.getContext('2d');
      var tarAbove = jsPsych.timelineVariable('tarAbove', true);
      var fixSize = jsPsych.timelineVariable('fixSize', true);
      var fixThick = 3;
      var tarSize = 13.35;
      var xCenter = 1500/2;
      var yCenter = 850/2;
      var tar1Y = jsPsych.data.getLastTimelineData().filter({test_part: 'fixation1'}).last(1).values()[0].tar1Y;
      var dist = jsPsych.data.getLastTimelineData().filter({test_part: 'fixation1'}).last(1).values()[0].dist;
      var tar2Y = tar1Y + (tarAbove * dist);

        /* Fixation */
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(xCenter, yCenter, (fixSize/2), 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.fillRect(xCenter-(fixSize/2), yCenter-(fixThick/2), fixSize, fixThick);
        ctx.fillRect(xCenter-(fixThick/2), yCenter-(fixSize/2), fixThick, fixSize);
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(xCenter, yCenter, fixThick/3, 0, 2 * Math.PI);
        ctx.fill();

        /* Target 2 */
        ctx.fillStyle = "blue";
        ctx.beginPath();
        ctx.arc(xCenter, tar2Y, tarSize/2, 0, 2 * Math.PI);
        ctx.fill();
    }

    /* define the screen that shows Target 2 */
    var target2 = {
      type: 'canvas-keyboard-response',
      stimulus: drawTar2,
      canvas_size: [850, 1500],
      choices: ['y', 'b'],
      data: { test_part: 'target2', correct_response: jsPsych.timelineVariable('correctAns'),
          procedure: jsPsych.timelineVariable('prac'),
          tarHalf: jsPsych.timelineVariable('tarHalf'), tarAbove: jsPsych.timelineVariable('tarAbove')},

      /* At the end of the trial, save the answer, check whether there is a
      trend, and check whether this was a switch trial */
      on_finish: function(data){
          data.correct = data.key_press == jsPsych.pluginAPI.convertKeyCharacterToKeyCode(data.correct_response);

          /* get the number of the current trial */
          var trials = jsPsych.data.getLastTimelineData().filter({test_part: 'target2'});
          data.nCurTrial = trials.count();

          /* check if there was a trned */
          if(data.nCurTrial > 1){
            var prev_trial_correct = jsPsych.data.getLastTimelineData().filter({test_part: 'target2'}).last(2).values()[0].correct;
            if(data.correct == prev_trial_correct){
              data.trend = 1;
            } else {
              data.trend = 0;
            }
          }

          /* check whether it was a switch trial (i.e. the previous trend was the same) */
          if(data.nCurTrial > 2){
            var prev_trend = jsPsych.data.getLastTimelineData().filter({test_part: 'target2'}).last(2).values()[0].trend;
            if(data.trend != prev_trend){
               data.switchTrial = 1;
            } else if (data.trend == prev_trend){
              data.switchTrial = 0;
            }
          }
        }
    }

    /* draw immediate feedback screen */
    function drawFeedback(c){
      var ctx = c.getContext('2d');
      var xCenter = 1500/2;
      var yCenter = 850/2;
      var last_trial_correct = jsPsych.data.getLastTimelineData().last(1).values()[0].correct;

      /* choose the feedback based on whether the response was correct */
      if(last_trial_correct){
          var feedbacktext = "Correct!";
        } else {
          var feedbacktext = "Incorrect";
        };
      ctx.font = "25px Arial";
      ctx.textAlign = "center";
      ctx.fillText(feedbacktext, xCenter, yCenter);
    }

    /* define the screen that shows the immediate feedback */
    var feedback = {
      type: 'canvas-keyboard-response',
      stimulus: drawFeedback,
      canvas_size: [850, 1500],
      data: {test_part: 'feedback', procedure: jsPsych.timelineVariable('prac')}
    }

    /* ======================= BUILD PRACTICE TRIALS ====================== */
    /* build practice trials */
    var procedurePrac = {
      timeline: [fixation1, target1, fixation2, target2, feedback],
      timeline_variables: [
        {tarHalf: -1, tarAbove: -1, correctAns: 'y', fixSize: 13.35, prac: "practice"},
        {tarHalf: 1, tarAbove: -1, correctAns: 'y', fixSize: 13.35, prac: "practice"},
        {tarHalf: -1, tarAbove: 1, correctAns: 'b', fixSize: 13.35, prac: "practice"},
        {tarHalf: 1, tarAbove: 1, correctAns: 'b', fixSize: 13.35, prac: "practice"}
      ],
      randomize_order: true,
      repetitions: 1
    }
    timeline.push(procedurePrac);

    /* define block debrief (feedback) */
    var debrief_block = {
      type: "html-keyboard-response",
      stimulus: function() {

        var trials = jsPsych.data.getLastTimelineData().filter({test_part: 'target2'});
        var correct_trials = trials.filter({correct:true});
        var accuracy = Math.round(correct_trials.count() / trials.count() * 100);
        var rt = Math.round(correct_trials.select('rt').mean());

        return "<p>You responded correctly on "+accuracy+"% of the trials.<p>"+
        "<p>Your average response time was "+rt+"ms.</p>"+
        "<p>Get ready for the real task and press any key to start!</p>";
      }
    };
    timeline.push(debrief_block);
        
    /* ======================= EYE TRACKING CALIBRATION ================== */
    /* start camera */
    // window.navigator.mediaDevices.getUserMedia({ video: true })
    // .then(function(stream) {
    //     stream.getTracks().forEach(track => track.stop());
    //     gorillaTaskBuilder.forceAdvance(); // only go to next screen when webcam permission was given
    // })
    // .catch(function() {
    //     alert('Kan webcam niet openen. Geef toestemming en probeer het nog eens.');
    // });
    
    /* make sure is still in full screen */
    function isFullscreen(){
        return (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    }

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

    if(!isFullscreen()){
        launchIntoFullscreen(document.documentElement);
    }
    
    /* calibration */
    var calibration = {
        type: "eye-tracking",
        minimumAccuracy: 0,
        videoOn: false,
        predictionOn: false
    };
    timeline.push(calibration);

    /* ==================== BUILD EXPERIMENTAL TRIALS ==================== */
    /* build experimental trials */
    var procedure = {
      timeline: [fixation1, target1, fixation2, target2, feedback],
      timeline_variables: [
        {tarHalf: -1, tarAbove: -1, correctAns: 'y', fixSize: 13.35, prac: "exp"},
        {tarHalf: 1, tarAbove: -1, correctAns: 'y', fixSize: 13.35, prac: "exp"},
        {tarHalf: -1, tarAbove: 1, correctAns: 'b', fixSize: 13.35, prac: "exp"},
        {tarHalf: 1, tarAbove: 1, correctAns: 'b', fixSize: 13.35, prac: "exp"}
      ],
      randomize_order: true,
      repetitions: 1,
      on_start: function(trial) {
          var eyes = collectEyeData();
          eye_data = eyes[0];
          eye_tracking_interval = eyes[1];
      },
      on_finish: function(trial_data){
          webgazer.pause();
          clearInterval(eye_tracking_interval);
          trial_data['eye_data'] = eye_data;
      }
    }
    timeline.push(procedure);

    /* ======================= DEFINE END SCREENS ======================= */
    /* exit fullscreen mode */
    timeline.push({
      type: 'fullscreen',
      fullscreen_mode: false
    });

    /* define exit message trial */
    var exit = {
      type: "html-keyboard-response",
      stimulus: "Thank you for participating. Please close the browser to exit."
    };
    timeline.push(exit);

    /* ============================ SAVE DATA ============================ */
    /* To be done! */

   	jsPsych.init({
		display_element: $('#gorilla')[0],
		timeline: timeline,
		on_data_update: function(data){
			gorilla.metric(data);
		},
		on_finish: function(){
			gorilla.finish();
		}
	});
})