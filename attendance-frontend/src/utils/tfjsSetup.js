import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
import * as faceapi from 'face-api.js';
import { LogBox } from 'react-native';

LogBox.ignoreLogs(['Initialization of backend rn-webgl failed']);

let isReady = false;

export const initTFJS = async () => {
  if (isReady) return;
  
  // 1. Initialize TFJS (Force CPU to avoid rn-webgl initialization crash/warning in Expo Go)
  await tf.setBackend('cpu');
  await tf.ready();
  console.log("TFJS Ready! Backend:", tf.getBackend());

  // 2. Monkey patch face-api.js environment for React Native
  faceapi.env.monkeyPatch({
    Canvas: class {},
    Image: class {},
    ImageData: class {},
    Video: class {},
    createCanvasElement: () => ({}),
    createImageElement: () => ({}),
  });

  // 3. Load Models using bundleResourceIO
  // We use the underlying tfjs loadGraphModel so face-api can read the weights
  try {
    const tinyFaceDetectorModel = await tf.loadGraphModel(
      bundleResourceIO(
        require('../../assets/models/face-api/tiny_face_detector_model-weights_manifest.json'),
        require('../../assets/models/face-api/tiny_face_detector_model-shard1')
      )
    );
    await faceapi.nets.tinyFaceDetector.loadFromWeightMap(tinyFaceDetectorModel.weights);
    console.log("TinyFaceDetector loaded!");

    const landmarkModel = await tf.loadGraphModel(
      bundleResourceIO(
        require('../../assets/models/face-api/face_landmark_68_model-weights_manifest.json'),
        require('../../assets/models/face-api/face_landmark_68_model-shard1')
      )
    );
    await faceapi.nets.faceLandmark68Net.loadFromWeightMap(landmarkModel.weights);
    console.log("FaceLandmark68 loaded!");

    const recognitionModel = await tf.loadGraphModel(
      bundleResourceIO(
        require('../../assets/models/face-api/face_recognition_model-weights_manifest.json'),
        require('../../assets/models/face-api/face_recognition_model-shard1')
      )
    );
    await faceapi.nets.faceRecognitionNet.loadFromWeightMap(recognitionModel.weights);
    console.log("FaceRecognitionNet loaded!");

  } catch (error) {
    console.error("Error loading TFJS models:", error);
  }

  isReady = true;
};
