// FaceService.js
// Handles cosine similarity, risk score calculation for the on-device ML pipeline

export const SIMILARITY_THRESHOLD = 0.40;

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
