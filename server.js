//Load modules
const http = require("http");
const fs = require('fs');
const url = require('url');
const mysql = require('mysql');
const request = require('request');
const sharp = require('sharp');

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

//TODO gérer les paths pour windows ??
const deleteFile = filepath => {
  fs.unlink(filepath, (err) => {
    if (err) throw err;
    console.log(`${filepath} was deleted`);
  })
}
const resize = function(inputFile, outputFile, newWidth){
  sharp(inputFile).resize({ width: newWidth}).toFile(outputFile)
    .then(function(newFileInfo) {
        console.log("Success");
    })
    .catch(function(err) {
        console.log("Error occured");
    });
}
   
const download = function(uri, filename, callback){
  localPath = './img/';
  request.head(uri, function(err, res, body){
    /* TO DO: TEST THE TYPE FOR 'IMAGE' AND THE SIZE INFERIOR TO ... */
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);
    localPath += filename;
    request(uri).pipe(fs.createWriteStream(localPath)).on('close', callback);
  });
};

let sizes = [300,600,800];

//Create HTTP server and listen on port 3000 for requests
const server = http.createServer((req, res) => {
  if (req.url != '/favicon.ico') { //Blocks the request for the favicon
    const q = url.parse(req.url, true);
    let imgUrl = q.pathname;
    //Queries the data base with espace to prevent SQL injections
    let sql = 'SELECT path FROM pictures WHERE url =' + mysql.escape(imgUrl);
    con.query(sql, function (err, result) {
      let filePath = null;
      //if imageUrl not in database
      if(result.length === 0){
        console.log('no result');
        if (imgUrl === '/'){
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain');
          res.end('No image\n');
          return;
        }
        //Creates a random name
         /* TO DO: HANDLE ALL IMAGE TYPES (JPEG, PNG, GIF, WEBP, TIFF) */
        let randomStr = `${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}.jpg`;
        //Downloads the image & stores it
        download(`http:/${imgUrl}`, `${randomStr}`, function(){
          console.log('done'); //fichier bien téléchargé
          let filePath =  `${__dirname}/img/${randomStr}`;
          let arrayPath = filePath.split('/');
          for (size of sizes){
            let sizedPath = `${size}-${arrayPath[arrayPath.length-1]}`;
            //resize image
            resize(filePath,  sizedPath, size);
          }
          
          //supprime l'image d'origine
          //TODO: CHANGE THE TIMEOUT TO A PROMISE OR AS A CALLBACK TO RESIZE
          setTimeout( () => deleteFile(filePath), 3000);
          let sql = `INSERT INTO pictures (url, path) VALUES (${mysql.escape(imgUrl)}, '${filePath}')`;
          con.query(sql, function (err, result) {
            if (err) throw err;
            console.log("1 record inserted");
            //Displays the image
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
          //Displays the image
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

