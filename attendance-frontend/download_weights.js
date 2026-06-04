const fs = require('fs');
const path = require('path');
const https = require('https');

const modelsDir = path.join(__dirname, 'assets', 'models', 'face-api');

if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const filesToDownload = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1'
];

function downloadFile(filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(modelsDir, filename);
    const url = baseUrl + filename;
    
    console.log(`Downloading ${filename}...`);
    const file = fs.createWriteStream(filePath);
    
    https.get(url, function(response) {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', function() {
        file.close();
        console.log(`Saved ${filename}`);
        resolve();
      });
    }).on('error', function(err) {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

async function run() {
  try {
    for (const file of filesToDownload) {
      await downloadFile(file);
    }
    console.log('All weights downloaded successfully.');
  } catch (err) {
    console.error('Error downloading weights:', err);
  }
}

run();
