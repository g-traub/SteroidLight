/* CA MARCHE SI L'IMAGE EST DANS LA BDD FAIRE AUSSI SI ELLE Y EST PAS */
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
let filePath;//problématique a déplacer ou a tester dans le code car pas forcement réévaluer !!quand on actualise et pas quand on appuie sur enter!!
let inDb; //a besoin d'être sinon elle se remis à zéro entre les deux requetes GET et POST ; test est répété à chaque fois donc la variable ne conserve jamais la même valeur pour deux images

//Create HTTP server and listen on port 3000 for requests
const server = http.createServer((req, res) => {
   //initialise la variable qui sert pour le test
  if (req.url === '/favicon.ico')return;
  if (req.method === 'GET' && !req.url.startsWith("/img/")){ //la deuxieme condition teste si le get est celui d'après la redirection
    console.log('get');
    //requete GET faite lorsque la page est actualisée
    const q = url.parse(req.url, true);
    imgUrl = q.pathname;
    if (imgUrl === '/'){
      console.log('no image');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.write("<html><body>No url image</body></html>");
      res.end();
      return;
    }
    //Vérification si l'image est dans la bdd
    let sql = 'SELECT path FROM pictures WHERE url =' + mysql.escape(imgUrl);
    con.query(sql, function (err, result) {
      if (err) throw err;
      console.log(result.length);
      filePath = null;
      //if imageUrl not in database
      if(result.length === 0){
        inDb = false;
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
        mode:\'same-origin'\,\
        method:\'POST\',\
        body: JSON.stringify(data),\
        headers: new Headers({\
          'Accept': 'application/json',\
          \'Content-Type\' : 'application/json'\
        }),\
      })\
    }\
    console.log(size);\
    postData('http://127.0.0.1:3000', size)\
    .then(function(res){ \
      console.log(res);\
      if(res.redirected){\
        window.location = res.url\
      } \
    })\
    .catch(function(res){ console.log(res) });\
    </script></body>");
    res.end();
  }
  else if(req.method === 'GET' && req.url.startsWith("/img/")){ //si apres redirection (url de l'image locale, on l'affiche)
    console.log('after redirect', req.url);
    const stream = fs.createReadStream('.'+ req.url);
    stream.pipe(res);
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
        //TO DO: HANDLE ALL IMAGE TYPES (JPEG, PNG, GIF, WEBP, TIFF)
        //Creates a random name
        let randomStr = `${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}.jpg`;
        //Downloads the image & stores it
        console.log(imgUrl);
        download(`http:/${imgUrl}`, `${randomStr}`, function(){
          console.log('done'); //fichier bien téléchargé
          let filePath =  `${__dirname}/img/${randomStr}`;
          //TODO: CHANGE THE PROMISE TO SKIP THE UNNECESSARY TEST AND APPLY ONLY AFTER THE 3 ARE MADE.
          let test = 0;
          for (let i = 0 ; i<sizes.length ; i++){
            let sizedPath = `${__dirname}/img/${sizes[i]}-${randomStr}`;
            
            //resize image
            resize(filePath, sizedPath, sizes[i]).then(()=>{
              test++;
              if (test === 3){
                deleteFile(filePath); //supprime l'original
                let prefix;
                if (browserWidth<510){
                  prefix = '300-';
                } else if (browserWidth<800){
                  prefix = '600-';
                } else if (browserWidth>800){
                  prefix = '800-';
                }
                //ajout du prefix dans le filepath
                filePath = filePath.split('/');
                filePath[filePath.length-1] = prefix + filePath[filePath.length-1];
                filePath = filePath.slice(filePath.length-2);//Récupère juste l'adresse relative
                filePath = filePath.join('/');
                console.log(filePath);
                //Redirects to image path
                let fullUrl = 'http://' +hostname+':'+port+'/'+filePath;
                res.writeHead(301, {
                  'Location': fullUrl
                });
                res.end();
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
        console.log('inDB');
        let prefix;
        if (browserWidth<510){
          prefix = '300-';
        } else if (browserWidth<800){
          prefix = '600-';
        } else if (browserWidth>800){
          prefix = '800-';
        }
        //récupere le filepath et rajoute le préfixe (pour éviter de stocker trois chemins pour chaque image)
        filePath = filePath.split('/');
        filePath[filePath.length-1] = prefix + filePath[filePath.length-1];
        filePath = filePath.slice(filePath.length-2);//Récupère juste l'adresse relative
        filePath = filePath.join('/');
        console.log(filePath);
        let fullUrl = 'http://' +hostname+':'+port+'/'+filePath;
        console.log(fullUrl);
        //Redirects to image path
        res.writeHead(301, {
          'Location': fullUrl
        });
        res.end();
      }
    });
  }
}); 
//listen for request on port 3000, and as a callback function have the port listened on logged
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

