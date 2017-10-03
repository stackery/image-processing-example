const stackery = require('stackery');

module.exports = function handler (message) {
  // Ignore all other events besides 'PUT'
  if (message.eventType !== 'put') {
    return {};
  }

  // Only operate on image files
  // For simplicity in this guide, we'll only operate on '.jpg' files
  let result = message.object.key.match(/(.*)\.jpg$/);
  if (result) {
    let params = {
      baseName: result[1],
      key: message.object.key
    };

    // Send a message to the "imageProcessor" function to operate on the image
    // There is no need for this function to wait for the "imageProcessor"
    // function to finish, so set the option "waitFor" to "TRANSMISSION"
    return stackery.output(params, {waitFor: 'TRANSMISSION'})
      .then(() => {
        return {};
      });
  }

  return {};
};
