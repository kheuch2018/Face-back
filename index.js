const express = require("express")
const app = express()
const cors = require("cors")
const bodyParser = require("body-parser")
const Busboy = require('busboy');
const AWS = require('aws-sdk')
var fileupload = require("express-fileupload");
const BUCKET_NAME = 'kalpay-faces';
const IAM_USER_KEY = 'AKIAQ7YRTJKBNGGTTA4X';
const IAM_USER_SECRET = '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';
AWS.config.region="us-east-2"
// AWS.config.region="us-east-2"
// AWS.config.accessKeyId=IAM_USER_KEY
// AWS.config.secretAccessKey=IAM_USER_SECRET
const config = new AWS.Config({
    accessKeyId: IAM_USER_KEY,
    secretAccessKey: IAM_USER_SECRET,
    region: 'us-east-1'
  })

  bodyParser.json({limit: "50mb"})
app.use(bodyParser.json())
app.use(fileupload());
app.use(cors())






function uploadToS3(file,fileName,res) {


    let s3bucket = new AWS.S3({
      accessKeyId: IAM_USER_KEY,
      secretAccessKey: IAM_USER_SECRET,
      Bucket: BUCKET_NAME
    });
    s3bucket.createBucket(function () {
        var params = {
          Bucket: BUCKET_NAME,
          Key: fileName,
          Body: file.data
        };
        s3bucket.upload(params, function (err, data) {
          if (err) {
            console.log('error in callback');
            console.log(err);
            res.status(400).send({err})
          }
          console.log('success');
          console.log(data);
          res.send({success: data})
        });
    });
  }
  
  app.post('/api/upload', function (req, res, next) {
    // This grabs the additional parameters so in this case passing in

    const {fileName} = req.body;
    if(!fileName) return res.status(400).send({err: "Paramètres invalides"})
    var busboy = new Busboy({ headers: req.headers });

    // The file upload has completed
    busboy.on('finish', function() {
      console.log('Upload finished');
   
      // Grabs your file object from the request.
      if(!req.files || !req.files.image) return res.status(400).send({err: "Paramètres invalides"})
      const {image: file} = req.files

      console.log(file);
      
      // Begins the upload to the AWS S3
      uploadToS3(file,fileName,res);
    });

    req.pipe(busboy);
  });

  
  app.post("/api/identify",(req,res) => {
    const {imageName} = req.body
    // const {photo_source,photo_target} = req.body
    const client = new AWS.Rekognition();
    const Myparams = {
        SourceImage: {
        S3Object: {
            Bucket: BUCKET_NAME,
            Name: "KHEUCH"
        },
        },
        TargetImage: {
        S3Object: {
            Bucket: BUCKET_NAME,
            Name: "kheuch2"
        },
        },
        SimilarityThreshold: 70
            
    }

    client.compareFaces(Myparams, function(err, response) {
        if (err) {
          console.log(err, err.stack); // an error occurred
        } else {
          response.FaceMatches.forEach(data => {
            let position   = data.Face.BoundingBox
            let similarity = data.Similarity
            console.log(`The face at: ${position.Left}, ${position.Top} matches with ${similarity} % confidence`)
            res.status({success: {confidence: similarity}})
          }) // for response.faceDetails
        } // if
      });
  })


app.listen(5000, () => console.log("listening on port 5000 ..."))