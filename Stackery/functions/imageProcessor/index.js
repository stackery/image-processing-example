const stackery = require('stackery');
const gm = require('gm').subClass({imageMagick: true});

module.exports = function handler (message) {
  let baseName = message.baseName;
  let imageBuffer;

  let params = {
    action: 'get',
    key: message.key
  };

  // Retrieve image from ObjectStore "Uploaded Images" 
  // which is connected to output port 0
  return stackery.output(params, {port: 0})
    .then((data) => {
      return new Promise((resolve, reject) => {
        imageBuffer = data[0].body;

        // For this demo, have imageMagick create a 200x200 thumbnail
        gm(imageBuffer)
          .resize(200, 200)
          .stream((err, stdout, stderr) => {
            let chunks = [];

            stdout.on('data', (chunk) => {
              chunks.push(chunk);
            });

            stdout.on('end', () => {
              resolve(Buffer.concat(chunks));
            });

            if (err) {
              console.log(`Error resizing image: ${err}`);
              reject(err);
            }

            stderr.on('data', function (data) {
              console.log(`Error resizing image: ${data}`);
              reject(new Error('Error resizing image'));
            });
          });
      });
    })
    .then((outputBuffer) => {
      // Store generated thumbnail to Object Store "Processed Images"
      // which is connected to output port 1
      let params = {
        action: 'put',
        key: `${baseName}.x200.jpeg`,
        body: outputBuffer,
        metadata: {'Content-Type': 'image/jpeg'}
      };
      return stackery.output(params, {port: 1});
    })
    .then((response) => {
      // Store the original image to Object Store "Processed Images"
      let params = {
        action: 'put',
        key: message.key,
        body: imageBuffer,
        metadata: {'Content-Type': 'image/jpeg'}
      };

      return stackery.output(params, {port: 1});
    })
    .then((response) => {
      // Delete the original image from Object Store "Uploaded Images"
      let params = {
        action: 'delete',
        key: message.key
      };

      return stackery.output(params, {port: 0});
    })
    .then((response) => {
      // Done!
      return {};
    })
    .catch((error) => {
      console.log(`Error: ${error}`);
      return {};
    });
};
