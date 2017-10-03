module.exports = function handler(request, output) {
  // Log the request to the console.
  console.log('Request:')
  console.dir(request)
  
  let responseBody = `
    <html>
      <body>
        <h4>Woot!</h4>
        <p>Try this: <a href="hi">hi</a>. It will echo "hi" back to you!</p>
      </body>
    </html>
  `

  // Build an HTTP response.
  let response = {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html"
    },
    body: responseBody
  }
  
  return response
}