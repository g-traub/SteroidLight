const http = require("http");
/* const { parse } = require('querystring'); */

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  if (req.method === 'POST'){
    let body = '';
    req.on('data' , chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      console.log(body);
      body = JSON.parse(body);
      console.log(body.width);
      res.end('ok');
    });
  }
  else{
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.write("<html><body><script>\
    const size = {width: window.innerWidth, pixelRatio: window.devicePixelRatio};\
    function postData(url, data){\
      return fetch(url, {\
        credentials: 'same-origin',\
        method:\'POST\',\
        body: JSON.stringify(data),\
        headers: new Headers({\
          \'Content-Type\' : 'application/json'\
        }),\
      })\
    }\
    console.log(size);\
    postData('http://localhost:3000', size);\
    </script></body>");
    res.end();
  }
});

//listen for request on port 3000, and as a callback function have the port listened on logged
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});