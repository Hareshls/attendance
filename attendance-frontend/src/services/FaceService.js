// FaceService.js
// Handles cosine similarity, risk score calculation for the on-device ML pipeline

import { loadTensorflowModel } from 'react-native-fast-tflite';
import * as tf from '@tensorflow/tfjs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import { Buffer } from 'buffer';

export const SIMILARITY_THRESHOLD = 0.55; // Relaxed threshold for unaligned face crops

let faceNetModel = null;

export const loadFaceNetModel = async () => {
  if (faceNetModel) return;
  try {
    faceNetModel = await loadTensorflowModel(
      require('../../assets/models/mobilefacenet.tflite'),
      [] // Empty array uses the default CPU delegate (safest fallback)
    );
    console.log("MobileFaceNet C++ Model Loaded Successfully!");
  } catch (error) {
    console.error("Failed to load MobileFaceNet C++ Model:", error);
  }
};

/**
 * Extract 128-d embedding directly from Base64 Image using fast-tflite C++ delegate
 */
export const extractEmbedding = async (base64Image) => {
  if (!faceNetModel) {
    await loadFaceNetModel();
  }

  // 1. Decode JPEG to TFJS Tensor (Fast native C++ decoder)
  const raw = Buffer.from(base64Image, 'base64');
  const tensor = decodeJpeg(new Uint8Array(raw)); // shape [H, W, 3]

  // 2. Resize exactly to MobileFaceNet's required 112x112 dimensions
  const resized = tf.image.resizeBilinear(tensor, [112, 112]);
  tensor.dispose();

  // 3. Normalize pixels from 0-255 to 0.0-1.0
  let inputTensor;
  if (faceNetModel.inputs[0].dataType === 'uint8') {
    // Model expects 0-255 uint8 values
    const uint8Tensor = resized.cast('int32'); // tfjs doesn't have uint8 natively, use int32 then convert
    const data = await uint8Tensor.data();
    inputTensor = new Uint8Array(data);
    uint8Tensor.dispose();
  } else {
    // Model expects Float32
    const normalized = resized.div(255.0); // or (val - 127.5)/128.0
    const data = await normalized.data();
    inputTensor = new Float32Array(data);
    normalized.dispose();
  }
  resized.dispose();

  // 6. Run C++ inference!
  // We MUST pass the .buffer property to react-native-fast-tflite.
  // Now that the byteLength matches what the model expects, it will actually process it!
  const outputBuffers = await faceNetModel.run([inputTensor.buffer]);

  // 7. The output is a raw memory ArrayBuffer. 
  // Depending on whether the model is INT8 Quantized or Float32, the byteLength changes.
  const rawBuffer = outputBuffers[0];
  let embeddingArray = [];

  console.log("=== TENSOR OUTPUT DEBUG ===");
  console.log("Raw ByteLength:", rawBuffer.byteLength);
  const u8 = new Uint8Array(rawBuffer);
  console.log("First 10 Bytes (Hex):", Array.from(u8.slice(0, 10)).map(x => x.toString(16).padStart(2, '0')).join(' '));
  console.log("First 10 Bytes (Uint8):", Array.from(u8.slice(0, 10)).join(' '));
  const i8 = new Int8Array(rawBuffer);
  console.log("First 10 Bytes (Int8):", Array.from(i8.slice(0, 10)).join(' '));

  if (rawBuffer.byteLength === 128) {
    // Model output is INT8 (128 bytes = 128 values)
    const int8View = new Int8Array(rawBuffer);
    embeddingArray = Array.from(int8View).map(v => v / 127.0); // Normalize -1.0 to 1.0
  } else if (rawBuffer.byteLength === 512) {
    // Model output is Float32 (512 bytes = 128 values * 4 bytes/float)
    const float32View = new Float32Array(rawBuffer);
    embeddingArray = Array.from(float32View);
  } else {
    // Fallback just in case
    const float32View = new Float32Array(rawBuffer);
    embeddingArray = Array.from(float32View);
  }

  return embeddingArray;
};

/**
 * Calculate Cosine Similarity between two embeddings.
 * @param {number[]} e1 - First embedding vector
 * @param {number[]} e2 - Second embedding vector
 * @returns {object} - { matched: boolean, similarity: number, distance: number }
 */
export const compareFaces = (e1, e2) => {
  if (!e1 || !e2 || e1.length !== e2.length) {
    return { matched: false, similarity: 0, distance: 1 };
  }

  let dotProduct = 0;
  let normE1 = 0;
  let normE2 = 0;

  for (let i = 0; i < e1.length; i++) {
    dotProduct += e1[i] * e2[i];
    normE1 += e1[i] * e1[i];
    normE2 += e2[i] * e2[i];
  }

  if (normE1 === 0 || normE2 === 0) {
    return { matched: false, similarity: 0, distance: 1 };
  }

  const cosineSimilarity = dotProduct / (Math.sqrt(normE1) * Math.sqrt(normE2));
  const distance = 1 - cosineSimilarity;
  const similarityScore = Number((cosineSimilarity * 100).toFixed(2));

  return {
    matched: distance < SIMILARITY_THRESHOLD,
    similarity: similarityScore,
    distance: Number(distance.toFixed(4)),
  };
};

/**
 * Calculate Bayesian Risk Score
 * Temporal decay: trust decays 2 points/hour after check-in.
 */
export const calculateRiskScore = ({
  faceOk,
  livenessOk,
  zoneOk,
  deviceOk,
  temporalOk = true,
  hoursSinceCheckin = 0,
}) => {
  const pFace = faceOk ? 0.97 : 0.05;
  const pLiveness = livenessOk ? 0.96 : 0.04;
  const pZone = zoneOk ? 0.95 : 0.10;
  const pDevice = deviceOk ? 0.98 : 0.15;
  const pTemporal = temporalOk ? 0.95 : 0.20;

  // Temporal decay: 2 points/hour
  const decay = Math.min(hoursSinceCheckin * 2, 40) / 100;
  let trust = pFace * pLiveness * pZone * pDevice * pTemporal;
  trust = Math.max(0, trust - decay);

  const pFraud = Number((1 - trust).toFixed(4));
  const trustPct = Number((trust * 100).toFixed(1));

  let riskLevel = 'LOW';
  if (pFraud >= 0.1 && pFraud < 0.4) riskLevel = 'MEDIUM';
  if (pFraud >= 0.4) riskLevel = 'HIGH';

  return {
    trust_score: trustPct,
    p_fraud: pFraud,
    risk_level: riskLevel,
    decay_applied: Number(decay.toFixed(3)),
    reason: `Risk: ${riskLevel} | Trust: ${trustPct}%`,
  };
};

/**
 * Micro-Movement Liveness Detection
 * Detects if a printed photo is being held up by comparing two consecutive frames.
 * A static photo will have almost 100% identical embeddings.
 * A live face will have slight micro-movements (breathing, blinking, etc).
 */
export const checkLivenessByMovement = (emb1, emb2) => {
  const { similarity } = compareFaces(emb1, emb2);
  
  // Active Liveness Detection: We asked the user to perform a challenge (e.g. SMILE, TURN LEFT).
  // If they hold a photo, the similarity will remain extremely high (> 98%).
  // If a real human performs the challenge, their 3D facial structure changes, dropping similarity to ~85-95%.
  if (similarity >= 98.0) {
    return { isLive: false, reason: `SPOOF DETECTED: Face did not move. (Score: ${similarity}%)` };
  }
  
  if (similarity < 60.0) {
     return { isLive: false, reason: "SPOOF DETECTED: Face lost during capture." };
  }
  
  // If similarity is too low, it's either a different person or the face moved out of frame.
  if (similarity < 85.0) {
     return { isLive: false, reason: "SPOOF DETECTED: Unstable face tracking" };
  }

  return { isLive: true, reason: "LIVE FACE DETECTED" };
};

