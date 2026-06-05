import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

import { LogBox } from 'react-native';

LogBox.ignoreLogs(['Initialization of backend rn-webgl failed']);

let isReady = false;

export const initTFJS = async () => {
  if (isReady) return;
  
  // 1. Initialize TFJS (Allow native C++ WebGL to initialize)
  await tf.ready();
  console.log("TFJS Ready! Backend:", tf.getBackend());

  // We no longer load face-api models here, as we use fast-tflite!
  console.log("TFJS initialized purely for image resizing!");
  
  isReady = true;
};
