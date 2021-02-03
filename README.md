# Eye Tracking
Custom JSPsych plugin for eye tracking using Webgazer.js.
This plugin can be used on a standalone basis with [JSPsych](https://www.jspsych.org/) (see [below](#Usage) for tutorial). It can be implemented in [Gorilla](https://gorilla.sc/) by following the "Gorilla and JSPsych" tutorial and completing the [following](#Usage) steps.

---
## Build

This project was built using JavaScript, HTML5, and CSS3. It uses external libraries:
- JQuery.js
- Sweetalert.js
- JSPsych.js
- Webgazer.js

---
## Requirements

To run this code, you need:
- A (local) server, for example a simple Python http server

---
## Usage

1. Set up your JSPsych project using [their tutorial](https://www.jspsych.org/tutorials/hello-world/)

2. Add the [plugin file](./static/js/jspsych-eyetracking.js) to the "plugins" folder of your JSPsych project

3. Add the [webgazer library](./static/js/webgazer.js) and [jQuery](./static/js/jquery.min.js) to a desired location in your project

4. Add the following code to the header of your html file (depending on the location of your files):
```html
<script src="jquery.min.js"></script>
<script src="https://unpkg.com/sweetalert/dist/sweetalert.min.js"></script>
<script src="webgazer.js"></script>
<script src="jspsych/plugins/jspsych-eyetracking.js"></script>
<link rel="stylesheet" href="jspsych-eyetracking.css">
```
> It is important to import jQuery, SweetAlert, and Webgazer before the eye tracking plugin.

5. Add a calibration trial to your [JSPsych timeline](https://www.jspsych.org/overview/timeline/) using this code:
```js
var calibration = {
    type: "eye-tracking",
    minimumAccuracy: 0,
    videoOn: true,
    predictionOn: true,
    on_finish: function(trial){
        webgazer.pause();
    }
};
timeline.push(calibration);
```
> The `videoOn` and `predictionOn` parameters can be set to `true` or `false`, depending on whether you want to display the video preview and prediction points after calibration has finished.

6. Declare the following global variables (right above or underneath declaring your timeline variable):
```js
var eye_data;
var eye_tracking_interval;
```

7. Add this code to all of the trials during which you want to record eye tracking data:
```js
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
```

8. You are good to go!

---
## License
- JSPsych-eyetracking.js by Neele Dijkstra

This plugin is open source, free for use, and is in no way affiliated with JSPsych or Webgazer.

### Acknowledgements
Thanks to:
- For Webgazer: @inproceedings{papoutsaki2016webgazer,
  author = {Alexandra Papoutsaki and Patsorn Sangkloy and James Laskey and Nediyana Daskalova and Jeff Huang and James Hays},
  title = {WebGazer: Scalable Webcam Eye Tracking Using User Interactions},
  booktitle = {Proceedings of the 25th International Joint Conference on Artificial Intelligence (IJCAI)},
  pages = {3839--3845},
  year = {2016},
  organization={AAAI}
}
- For JSPsych: de Leeuw, J. R. (2015). jsPsych: A JavaScript library for creating behavioral experiments in a web browser. Behavior Research Methods, 47(1), 1-12. doi:10.3758/s13428-014-0458-y.
