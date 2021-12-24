import * as THREE from "three";
import _ from "loadsh";

import _u from "../utils/utils";

const { initTrackballControls } = _u;
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { GUI } from 'three/examples/jsm/libs/dat.gui.module';

console.log("initTrackballControls", initTrackballControls, THREE);

var Stats = function () {
  var mode = 0;

  var container = document.createElement("div");
  container.style.cssText =
    "position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000";
  container.addEventListener(
    "click",
    function (event) {
      event.preventDefault();
      showPanel(++mode % container.children.length);
    },
    false
  );

  //

  function addPanel(panel) {
    container.appendChild(panel.dom);
    return panel;
  }

  function showPanel(id) {
    for (var i = 0; i < container.children.length; i++) {
      container.children[i].style.display = i === id ? "block" : "none";
    }

    mode = id;
  }

  //

  var beginTime = (performance || Date).now(),
    prevTime = beginTime,
    frames = 0;

  var fpsPanel = addPanel(new Stats.Panel("FPS", "#0ff", "#002"));
  var msPanel = addPanel(new Stats.Panel("MS", "#0f0", "#020"));

  if (self.performance && self.performance.memory) {
    var memPanel = addPanel(new Stats.Panel("MB", "#f08", "#201"));
  }

  showPanel(0);

  return {
    REVISION: 16,

    dom: container,

    addPanel: addPanel,
    showPanel: showPanel,

    begin: function () {
      beginTime = (performance || Date).now();
    },

    end: function () {
      frames++;

      var time = (performance || Date).now();

      msPanel.update(time - beginTime, 200);

      if (time > prevTime + 1000) {
        fpsPanel.update((frames * 1000) / (time - prevTime), 100);

        prevTime = time;
        frames = 0;

        if (memPanel) {
          var memory = performance.memory;
          memPanel.update(
            memory.usedJSHeapSize / 1048576,
            memory.jsHeapSizeLimit / 1048576
          );
        }
      }

      return time;
    },

    update: function () {
      beginTime = this.end();
    },

    // Backwards Compatibility

    domElement: container,
    setMode: showPanel,
  };
};

Stats.Panel = function (name, fg, bg) {
  var min = Infinity,
    max = 0,
    round = Math.round;
  var PR = round(window.devicePixelRatio || 1);

  var WIDTH = 80 * PR,
    HEIGHT = 48 * PR,
    TEXT_X = 3 * PR,
    TEXT_Y = 2 * PR,
    GRAPH_X = 3 * PR,
    GRAPH_Y = 15 * PR,
    GRAPH_WIDTH = 74 * PR,
    GRAPH_HEIGHT = 30 * PR;

  var canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.style.cssText = "width:80px;height:48px";

  var context = canvas.getContext("2d");
  context.font = "bold " + 9 * PR + "px Helvetica,Arial,sans-serif";
  context.textBaseline = "top";

  context.fillStyle = bg;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = fg;
  context.fillText(name, TEXT_X, TEXT_Y);
  context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);

  context.fillStyle = bg;
  context.globalAlpha = 0.9;
  context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);

  return {
    dom: canvas,

    update: function (value, maxValue) {
      min = Math.min(min, value);
      max = Math.max(max, value);

      context.fillStyle = bg;
      context.globalAlpha = 1;
      context.fillRect(0, 0, WIDTH, GRAPH_Y);
      context.fillStyle = fg;
      context.fillText(
        round(value) + " " + name + " (" + round(min) + "-" + round(max) + ")",
        TEXT_X,
        TEXT_Y
      );

      context.drawImage(
        canvas,
        GRAPH_X + PR,
        GRAPH_Y,
        GRAPH_WIDTH - PR,
        GRAPH_HEIGHT,
        GRAPH_X,
        GRAPH_Y,
        GRAPH_WIDTH - PR,
        GRAPH_HEIGHT
      );

      context.fillRect(GRAPH_X + GRAPH_WIDTH - PR, GRAPH_Y, PR, GRAPH_HEIGHT);

      context.fillStyle = bg;
      context.globalAlpha = 0.9;
      context.fillRect(
        GRAPH_X + GRAPH_WIDTH - PR,
        GRAPH_Y,
        PR,
        round((1 - value / maxValue) * GRAPH_HEIGHT)
      );
    },
  };
};

let scene, renderer, camera, stats;
let model, skeleton, mixer, clock;

const crossFadeControls = [];

let idleAction, walkAction, runAction;
let idleWeight, walkWeight, runWeight;
let actions, settings;

let singleStepMode = false;
let sizeOfNextStep = 0;

init();

function init() {

  const container = document.getElementById( 'app' );

  camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 1000 );
  camera.position.set( 1, 2, - 3 );
  camera.lookAt( 0, 1, 0 );

  clock = new THREE.Clock();

  scene = new THREE.Scene();
  scene.background = new THREE.Color( 0xa0a0a0 );
  scene.fog = new THREE.Fog( 0xa0a0a0, 10, 50 );

  const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
  hemiLight.position.set( 0, 20, 0 );
  scene.add( hemiLight );

  const dirLight = new THREE.DirectionalLight( 0xffffff );
  dirLight.position.set( - 3, 10, - 10 );
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 2;
  dirLight.shadow.camera.bottom = - 2;
  dirLight.shadow.camera.left = - 2;
  dirLight.shadow.camera.right = 2;
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 40;
  scene.add( dirLight );

  // scene.add( new THREE.CameraHelper( dirLight.shadow.camera ) );

  // ground

  const mesh = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
  mesh.rotation.x = - Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add( mesh );

  const loader = new GLTFLoader();
  loader.load( './src/modale/Soldier.glb', function ( gltf ) {

    model = gltf.scene;
    scene.add( model );

    model.traverse( function ( object ) {

      if ( object.isMesh ) object.castShadow = true;

    } );

    //

    skeleton = new THREE.SkeletonHelper( model );
    skeleton.visible = false;
    scene.add( skeleton );

    //

    createPanel();


    //

    const animations = gltf.animations;

    //AnimationMixer是场景中特定对象的动画播放器。当场景中的多个对象独立动画时，可以为每个对象使用一个AnimationMixer
    mixer = new THREE.AnimationMixer( model );

    idleAction = mixer.clipAction( animations[ 0 ] );
    walkAction = mixer.clipAction( animations[ 3 ] );
    runAction = mixer.clipAction( animations[ 1 ] );

    actions = [ idleAction, walkAction, runAction ];

    activateAllActions();

    animate();

  } );

  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  container.appendChild( renderer.domElement );

  stats = new Stats();
  container.appendChild( stats.dom );

  window.addEventListener( 'resize', onWindowResize );

}

function createPanel() {

  const panel = new GUI( { width: 310 } );

  const folder1 = panel.addFolder( 'Visibility' );
  const folder2 = panel.addFolder( 'Activation/Deactivation' );
  const folder3 = panel.addFolder( 'Pausing/Stepping' );
  const folder4 = panel.addFolder( 'Crossfading' );
  const folder5 = panel.addFolder( 'Blend Weights' );
  const folder6 = panel.addFolder( 'General Speed' );

  settings = {
    'show model': true,
    'show skeleton': false,
    'deactivate all': deactivateAllActions,
    'activate all': activateAllActions,
    'pause/continue': pauseContinue,
    'make single step': toSingleStepMode,
    'modify step size': 0.05,
    'from walk to idle': function () {

      prepareCrossFade( walkAction, idleAction, 1.0 );

    },
    'from idle to walk': function () {

      prepareCrossFade( idleAction, walkAction, 0.5 );

    },
    'from walk to run': function () {

      prepareCrossFade( walkAction, runAction, 2.5 );

    },
    'from run to walk': function () {

      prepareCrossFade( runAction, walkAction, 5.0 );

    },
    'use default duration': true,
    'set custom duration': 3.5,
    'modify idle weight': 0.0,
    'modify walk weight': 1.0,
    'modify run weight': 0.0,
    'modify time scale': 1.0
  };

  folder1.add( settings, 'show model' ).onChange( showModel );
  folder1.add( settings, 'show skeleton' ).onChange( showSkeleton );
  folder2.add( settings, 'deactivate all' );
  folder2.add( settings, 'activate all' );
  folder3.add( settings, 'pause/continue' );
  folder3.add( settings, 'make single step' );
  folder3.add( settings, 'modify step size', 0.01, 0.1, 0.001 );
  crossFadeControls.push( folder4.add( settings, 'from walk to idle' ) );
  crossFadeControls.push( folder4.add( settings, 'from idle to walk' ) );
  crossFadeControls.push( folder4.add( settings, 'from walk to run' ) );
  crossFadeControls.push( folder4.add( settings, 'from run to walk' ) );
  folder4.add( settings, 'use default duration' );
  folder4.add( settings, 'set custom duration', 0, 10, 0.01 );
  folder5.add( settings, 'modify idle weight', 0.0, 1.0, 0.01 ).listen().onChange( function ( weight ) {

    setWeight( idleAction, weight );

  } );
  folder5.add( settings, 'modify walk weight', 0.0, 1.0, 0.01 ).listen().onChange( function ( weight ) {

    setWeight( walkAction, weight );

  } );
  folder5.add( settings, 'modify run weight', 0.0, 1.0, 0.01 ).listen().onChange( function ( weight ) {

    setWeight( runAction, weight );

  } );
  folder6.add( settings, 'modify time scale', 0.0, 1.5, 0.01 ).onChange( modifyTimeScale );

  folder1.open();
  folder2.open();
  folder3.open();
  folder4.open();
  folder5.open();
  folder6.open();

}


function showModel( visibility ) {

  model.visible = visibility;

}


function showSkeleton( visibility ) {

  skeleton.visible = visibility;

}


function modifyTimeScale( speed ) {

  mixer.timeScale = speed;

}


function deactivateAllActions() {

  actions.forEach( function ( action ) {

    action.stop();

  } );

}

function activateAllActions() {

  setWeight( idleAction, settings[ 'modify idle weight' ] );
  setWeight( walkAction, settings[ 'modify walk weight' ] );
  setWeight( runAction, settings[ 'modify run weight' ] );

  actions.forEach( function ( action ) {

    action.play();

  } );

}

function pauseContinue() {

  if ( singleStepMode ) {

    singleStepMode = false;
    unPauseAllActions();

  } else {

    if ( idleAction.paused ) {

      unPauseAllActions();

    } else {

      pauseAllActions();

    }

  }

}

function pauseAllActions() {

  actions.forEach( function ( action ) {

    action.paused = true;

  } );

}

function unPauseAllActions() {

  actions.forEach( function ( action ) {

    action.paused = false;

  } );

}

function toSingleStepMode() {

  unPauseAllActions();

  singleStepMode = true;
  sizeOfNextStep = settings[ 'modify step size' ];

}

function prepareCrossFade( startAction, endAction, defaultDuration ) {

  // Switch default / custom crossfade duration (according to the user's choice)

  const duration = setCrossFadeDuration( defaultDuration );

  // Make sure that we don't go on in singleStepMode, and that all actions are unpaused

  singleStepMode = false;
  unPauseAllActions();

  // If the current action is 'idle' (duration 4 sec), execute the crossfade immediately;
  // else wait until the current action has finished its current loop

  if ( startAction === idleAction ) {

    executeCrossFade( startAction, endAction, duration );

  } else {

    synchronizeCrossFade( startAction, endAction, duration );

  }

}

function setCrossFadeDuration( defaultDuration ) {

  // Switch default crossfade duration <-> custom crossfade duration

  if ( settings[ 'use default duration' ] ) {

    return defaultDuration;

  } else {

    return settings[ 'set custom duration' ];

  }

}

function synchronizeCrossFade( startAction, endAction, duration ) {

  mixer.addEventListener( 'loop', onLoopFinished );

  function onLoopFinished( event ) {

    if ( event.action === startAction ) {

      mixer.removeEventListener( 'loop', onLoopFinished );

      executeCrossFade( startAction, endAction, duration );

    }

  }

}

function executeCrossFade( startAction, endAction, duration ) {

  // Not only the start action, but also the end action must get a weight of 1 before fading
  // (concerning the start action this is already guaranteed in this place)

  setWeight( endAction, 1 );
  endAction.time = 0;

  // Crossfade with warping - you can also try without warping by setting the third parameter to false

  startAction.crossFadeTo( endAction, duration, true );

}

// This function is needed, since animationAction.crossFadeTo() disables its start action and sets
// the start action's timeScale to ((start animation's duration) / (end animation's duration))

function setWeight( action, weight ) {

  action.enabled = true;
  action.setEffectiveTimeScale( 1 );
  action.setEffectiveWeight( weight );

}

// Called by the render loop

function updateWeightSliders() {

  settings[ 'modify idle weight' ] = idleWeight;
  settings[ 'modify walk weight' ] = walkWeight;
  settings[ 'modify run weight' ] = runWeight;

}

// Called by the render loop

function updateCrossFadeControls() {

  // if ( idleWeight === 1 && walkWeight === 0 && runWeight === 0 ) {

  //   crossFadeControls[ 0 ].disable();
  //   crossFadeControls[ 1 ].enable();
  //   crossFadeControls[ 2 ].disable();
  //   crossFadeControls[ 3 ].disable();

  // }

  // if ( idleWeight === 0 && walkWeight === 1 && runWeight === 0 ) {

  //   crossFadeControls[ 0 ].enable();
  //   crossFadeControls[ 1 ].disable();
  //   crossFadeControls[ 2 ].enable();
  //   crossFadeControls[ 3 ].disable();

  // }

  // if ( idleWeight === 0 && walkWeight === 0 && runWeight === 1 ) {

  //   crossFadeControls[ 0 ].disable();
  //   crossFadeControls[ 1 ].disable();
  //   crossFadeControls[ 2 ].disable();
  //   crossFadeControls[ 3 ].enable();

  // }

}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

  // Render loop

  requestAnimationFrame( animate );

  idleWeight = idleAction.getEffectiveWeight();
  walkWeight = walkAction.getEffectiveWeight();
  runWeight = runAction.getEffectiveWeight();

  // Update the panel values if weights are modified from "outside" (by crossfadings)

  updateWeightSliders();

  // Enable/disable crossfade controls according to current weight values

  updateCrossFadeControls();

  // Get the time elapsed since the last frame, used for mixer update (if not in single step mode)

  let mixerUpdateDelta = clock.getDelta();

  // If in single step mode, make one step and then do nothing (until the user clicks again)

  if ( singleStepMode ) {

    mixerUpdateDelta = sizeOfNextStep;
    sizeOfNextStep = 0;

  }

  // Update the animation mixer, the stats panel, and render this frame

  mixer.update( mixerUpdateDelta );

  stats.update();

  renderer.render( scene, camera );

}