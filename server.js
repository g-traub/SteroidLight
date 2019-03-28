//Load HTTP module
const http = require("http");
const fs = require('fs');
const url = require('url');
const mysql = require('mysql');
const request = require('request');

const hostname = '127.0.0.1';
const port = 3000;

const con = mysql.createConnection({
  host: "127.0.0.1",
  port: "8889",
  user: "root",
  password: "root",
  database: "steroidbdd"
})
let localPath;

const download = function(uri, filename, callback){
  localPath = './img/';
  request.head(uri, function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);
    localPath += filename;
    request(uri).pipe(fs.createWriteStream(localPath)).on('close', callback);
  });
};
//Create HTTP server and listen on port 3000 for requests
const server = http.createServer((req, res) => {
  if (req.url != '/favicon.ico') { //Blocks the request for the favicon
    const q = url.parse(req.url, true);
    let imgUrl = q.pathname;
    //Queries the data base with espace to prevent SQL injections
    let sql = 'SELECT path FROM pictures WHERE url =' + mysql.escape(imgUrl);
    con.query(sql, function (err, result) {
      let filePath = null;
      console.log(result);
      console.log(__dirname);
      //if imageUrl nott in database
      if(result.length === 0){
        console.log('no result');
        console.log(imgUrl);
        //Creates a random name
        let randomStr = `${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}.jpg`;
        console.log(randomStr);
        //Downloads the image & stores it
        download(`http:/${imgUrl}`, `${randomStr}`, function(){
          console.log('done');
          let filePath =  `${__dirname}/img/${randomStr}`;
          let sql = `INSERT INTO pictures (url, path) VALUES (${mysql.escape(imgUrl)}, '${filePath}')`;
          con.query(sql, function (err, result) {
            if (err) throw err;
            console.log("1 record inserted");
            fs.readFile(filePath, function(err, data) {
              if(err) throw err;
              res.statusCode = 200;
              res.setHeader('Content-Type', 'image/jpeg');
              res.write(data);
              return res.end();
            })
          });
        })
      }
      else{
         filePath = result[0].path;
          console.log(filePath);
          fs.readFile(filePath, function(err, data) {
            if(err) throw err;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'image/jpeg');
            res.write(data);
            return res.end();
          })
      }
      
    })
  }
});

//listen for request on port 3000, and as a callback function have the port listened on logged
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

