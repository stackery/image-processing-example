# Image Processing

### Use Case
If your users can upload pictures, one feature you may want is to automatically create smaller versions of the pictures. These smaller versions will be better suited for serving to mobile users or to use as thumbnails. In this guide, we'll show you how Stackery makes this incredibly easy.

In this guide, we will be using 3 node types:
* [Function](https://docs.stackery.io/nodes/Function) nodes to do the image processing and handle/filter upload notifications 
* [ObjectStore](https://docs.stackery.io/nodes/ObjectStore) nodes to store the images from the user
* [Link](https://docs.stackery.io/nodes/Link) nodes to make our Stack look cleaner 

### Prerequisites
* [Stackery](https://stackery.io) account ([Sign-up here](https://app.stackery.io/sign-up))

### How To
You can follow along by copying our example stack at [https://github.com/stackery/image-processing-example](https://github.com/stackery/image-processing-example).

Let's first create the overall architecture of our stack.
1. [Create a new Stackery stack](https://app.stackery.io/new).
  * Select a git provider (In order to follow along, it will be easiest if you choose GitHub. If you want to use AWS, you'll need to understand how to clone from [AWS CodeCommit](https://aws.amazon.com/codecommit/)).
  * Set the **Stack Name** to 'imageProcessing' or another unique name of your choice.
  * Delete the 4 default nodes.
1. Add an [ObjectStore](https://docs.stackery.io/nodes/ObjectStore) node .
  * This is where users will upload pictures.
  * Set the **Name** to *Uploaded Images*.
1. Add a [Function](https://docs.stackery.io/nodes/Function) node .
  * This will be a lightweight function that will be notified when changes occur in the *Uploaded Images* ObjectStore, filter for new images, and then trigger the next function.
  * Set the **Name** to *notifier*. 
  * Connect the **input** to the *Uploaded Images* ObjectStore's **output**.
1. Add a [Function](https://docs.stackery.io/nodes/Function) node .
  * This function will modify the image and move it to the final ObjectStore.
  * Set the **Name** to *imageProcessor*.
  * Connect the **input** to the *notifier* functions's **output**.
  * Set the **Outputs** to *2*.
  * Set the **Timeout** to *120* seconds.
1. Add a [Link Out](https://docs.stackery.io/nodes/Link) node.
  * Connect the **input** to the *imageProcessors* function's **first output** (port 0).
1. Add a [Link In](https://docs.stackery.io/nodes/Link) node.
  * Connect the **output** to the *Uploaded Images* ObjectStore **input**.
  * The two Link nodes form a virtual wire. In this stack, it is equivalant to connecting the *imageProcessor* function output to the *Uploaded Images* ObjectStore input.
  * This will allow the *imageProcessor* function to fetch and delete images from the *Uploaded Images* ObjectStore.
1. Add an [ObjectStore](https://docs.stackery.io/nodes/ObjectStore) node.
  * Set the **Name** to *Processed Images*.
  * Connect the **input** to the *imageProcessor* function **second output** (port 1).
1. Click the **Save** button to save the stack.

That's it for the overall architeture of the stack! Your stack should now look similar to this:
![Image Processing Stack](https://docs.stackery.io/event_driven/imageProcessingStack.png)

With this, when you deploy, Stackery will take care of correctly setting all the permissions for the interactions between the various nodes!

But before you deploy, let's flesh out the two functions. As we need to use a 3rd party package to modify images, we will need to clone the repo and make some changes locally.

1. Clone your git repo
1. In your editor of choice, open `<repo>/Stackery/functions/notifier/index.js`
    * Overwrite the existing code with the following:
        ```javascript
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
        ```
    * Save and close the file
1. open `<repo>/Stackery/functions/imageProcessor/index.js`
    * Overwrite the existing code with the following:
        ```javascript
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
        ```
      * Save and close the file
1. Create a new file `<repo>/Stackery/functions/imageProcessor/package.json`
    * Copy the following code into the file:
        ```javascript
        {
          "name": "ImageProcessor",
          "version": "",
          "dependencies": {
            "bluebird": "^3.5.0",
            "gm": "^1.23.0"
          }
        }
        ```
    * Save and close the file
1. Commit your changes
1. Push your changes back up to the git repo.

Now all that is left is to deploy the stack!
1. In your web browser, refresh the Stackery dashboard to get the changes you just pushed.
1. Click the **Prepare Deployment** button.
1. Wait a minute or so for the deployment to be prepared.
1. Click the **Deploy** button. This will open a new window with Change Set in [AWS CloudFormation](https://aws.amazon.com/cloudformation/).
1. Click the **Execute** button in the top right to deploy the stack.
1. Go back to the window with the Stackery dashboard and wait for the deployment to finish. In the sidebar, the deployment will move from the **Prepared Deployment** section to the **Current Deployment** section when the stack is fully deployed.

### Test it out
1. Click on the deployment in the **Current Deployment** section.
1. Select the *Uploaded Images* ObjectStore node.
1. Copy the **S3 Bucket Name**.
1. Open https://s3.console.aws.amazon.com/s3/buckets/**\<S3 Bucket Name\>** in a new tab.
1. Upload an image to the S3 Bucket.
1. Go back to the Stackery Dashboard.
1. Select the *Processed Images* ObjectStore node.
1. Copy the **S3 Bucket Name**.
1. Open https://s3.console.aws.amazon.com/s3/buckets/**\<S3 Bucket Name\>** in a new tab.
    * You should see the original image and a thumbnail suffixed with 'x200'

And just like that, you have a simple, serverless-based, automatic thumbnail generation!

### Final Steps
In order to make this truely operational, you'll want to create a RestAPI through which your users can upload their images. It turns out that it is a bit tricky to get large files uploaded via AWS API gateway. Don't worry, we have a guide to help you through that as well! Take a look at our [S3 Signed Urls Example](https://github.com/stackery/s3-signed-urls-example).