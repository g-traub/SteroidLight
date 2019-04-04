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
  return new Promise ((resolve, reject) => {
    sharp(inputFile).resize({ width: newWidth}).toFile(outputFile)
      .then(function(newFileInfo) {
          console.log("Success");
          resolve();
      })
      .catch(function(err) {
          console.log("Error occured");
      });
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
let browserWidth = 0;
let imgUrl = '';
let inDb;
let filePath;

//Create HTTP server and listen on port 3000 for requests
const server = http.createServer((req, res) => {
  if (req.url !== '/favicon.ico'){
    if (req.method === 'GET'){
      const q = url.parse(req.url, true);
      imgUrl = q.pathname;
      let sql = 'SELECT path FROM pictures WHERE url =' + mysql.escape(imgUrl);
      con.query(sql, function (err, result) {
        filePath = null;
        //if imageUrl not in database
        if(result.length === 0){
          inDb = false;
          if (imgUrl === '/'){
            console.log('no image');
            return;
          }
        }
        else{
          inDb = true;
          filePath = result[0].path;
        }
      });
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
    }
    if (req.method === 'POST'){
      let body = '';
      req.on('data' , chunk => {
      body += chunk.toString();
      });
      req.on('end', () => {
        body = JSON.parse(body);
        browserWidth = body.width;
        console.log(body.width);
        if (!inDb){
          //Creates a random name
          /* TO DO: HANDLE ALL IMAGE TYPES (JPEG, PNG, GIF, WEBP, TIFF) */
          let randomStr = `${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}.jpg`;
          //Downloads the image & stores it
          download(`http:/${imgUrl}`, `${randomStr}`, function(){
            console.log('done'); //fichier bien téléchargé
            let filePath =  `${__dirname}/img/${randomStr}`;
            //TODO: CHANGE THE PROMISE TO SKIP THE UNNECESSARY TEST AND APPLY ONLY AFTER THE 3 ARE MADE.
            let test = 0;
            for (let i = 0 ; i<sizes.length ; i++){
              let sizedPath = `${__dirname}/img/${sizes[i]}-${randomStr}`;
              //resize image
            /*  if (i<sizes.length-1){
                resize(filePath, sizedPath, sizes[i]);
              }
              else {
                resize(filePath, sizedPath, sizes[i]).then(()=>deleteFile(filePath));
              } */
              //supprime l'image d'origine
              resize(filePath, sizedPath, sizes[i]).then(()=>{
                test++;
                if (test === 3){
                  deleteFile(filePath);
                  let prefix;
                  if (browserWidth<510){
                    prefix = '300-';
                  } else if (browserWidth<800){
                    prefix = '600-';
                  } else if (browserWidth>800){
                    prefix = '800-';
                  }
                  filePath = filePath.split('/');
                  filePath[filePath.length-1] = prefix + filePath[filePath.length-1];
                  filePath = filePath.join('/');
                  console.log(filePath);
                  fs.readFile(filePath, function(err, data) {
                    if(err) throw err;
                    console.log('read not in Db')
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'image/jpeg');
                    res.write(data);
                    res.end();
                  })
                }
              })
            }
            let sql = `INSERT INTO pictures (url, path) VALUES (${mysql.escape(imgUrl)}, '${filePath}')`;
            con.query(sql, function (err, result) {
              if (err) throw err;
              console.log("1 record inserted");
            });
          })
        }
        else if(inDb){
          let prefix;
          if (browserWidth<510){
            prefix = '300-';
          } else if (browserWidth<800){
            prefix = '600-';
          } else if (browserWidth>800){
            prefix = '800-';
          }
          filePath = filePath.split('/');
          filePath[filePath.length-1] = prefix + filePath[filePath.length-1];
          filePath = filePath.join('/');
          console.log(filePath);
  
          //Displays the image
          fs.readFile(filePath, function(err, data) {
            if(err) throw err;
            console.log('read inDB');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'image/jpeg');
            res.write(data);
            res.end();
          })  
        }
      });
    }
  }
});  
//listen for request on port 3000, and as a callback function have the port listened on logged
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

