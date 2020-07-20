const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const Busboy = require("busboy");
const AWS = require("aws-sdk");
var fileupload = require("express-fileupload");
const BUCKET_NAME = "kalpay-faces";
const IAM_USER_KEY = "AKIAQ7YRTJKBIKVYEZYW";
const IAM_USER_SECRET = "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";
AWS.config.region = "us-east-2";
AWS.config.accessKeyId = IAM_USER_KEY;
AWS.config.secretAccessKey = IAM_USER_SECRET;
const config = new AWS.Config({
  accessKeyId: IAM_USER_KEY,
  secretAccessKey: IAM_USER_SECRET,
  region: "us-east-1",
});

const swaggerJsDoc = require('swagger-jsdoc')
const swaggerUI = require('swagger-ui-express')

const swaggerOptions = {
  swaggerDefinition: {
    info: {
      title: "Faces Comparing API",
      description: "compare two faces and give a confidence degree",
      contact: {
        name: "Cheikh Seck"
      },
      servers: ["http://localhost: 5000"]
    }
  },
  apis: ["index.js"]
}

const swaggerDocs = swaggerJsDoc(swaggerOptions)

bodyParser.json({ limit: "50mb" });
app.use(bodyParser.json());
app.use(fileupload());
app.use(cors());

app.use('/api-docs',swaggerUI.serve,swaggerUI.setup(swaggerDocs))


function uploadToS3(file, fileName, res,type) {
  let s3bucket = new AWS.S3({
    accessKeyId: IAM_USER_KEY,
    secretAccessKey: IAM_USER_SECRET,
    Bucket: BUCKET_NAME,
  });
  s3bucket.createBucket(function () {
    var params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file.data,
    };
    s3bucket.upload(params, function (err, data) {
      if (err) {
        console.log("error in callback");
        console.log(err);
        res.status(400).send({ err });
      }
      console.log("success");
      console.log(data);
      if(type!=="compare") return  res.send({ success: data });
      compareFaces(res,fileName)
      
    });
  });
}

let compareFaces = (res,fileName) => {
    const client = new AWS.Rekognition();
  const Myparams = {
    SourceImage: {
      S3Object: {
        Bucket: BUCKET_NAME,
        Name: fileName.split("-")[1],
      },
    },
    TargetImage: {
      S3Object: {
        Bucket: BUCKET_NAME,
        Name: fileName,
      },
    },
    // SimilarityThreshold: 70,
  };

  client.compareFaces(Myparams, (err, response) => {
    if (err) {
      console.log(err, err.stack); // an error occurred
      res.status(400).send({ err });
    } else {
      response.FaceMatches.forEach((data) => {
        let position = data.Face.BoundingBox;
        let similarity = data.Similarity;
        console.log(
          `The face at: ${position.Left}, ${position.Top} matches with ${similarity} % confidence`
        );
        res.send({ success: { confidence: similarity } });
      }); // for response.faceDetails

      response.UnmatchedFaces.forEach((data) => {
        res.status(404).send({err: "Faces not matching" });
      })
    } // if
  });
}
/**
 * @swagger
 * /api/upload:
 *  post:
 *    description: Used to upload user image when signing up
 *    parameters:
 *      - name: image
 *        description: Image to upload
 *        in: body
 *        required: true
 *      - name: idUser
 *        description: Id of the user
 *        in: body
 *        required: true
 *    responses:
 *      '200': 
 *        description: Image uploaded successfuly
 *      '400':
 *        description: Invalid parameters
 */
app.post("/api/upload", function (req, res, next) {
  // This grabs the additional parameters so in this case passing in
console.log("heho")
  const { idUser: fileName } = req.body;
  if (!fileName) return res.status(400).send({ err: "Paramètres invalides" });
  var busboy = new Busboy({ headers: req.headers });

  // The file upload has completed
  busboy.on("finish", function () {
    console.log("Upload finished");

    // Grabs your file object from the request.
    if (!req.files || !req.files.image)
      return res.status(400).send({ err: "Paramètres invalides" });
    const { image: file } = req.files;

    console.log(file);
    
    // Begins the upload to the AWS S3
    uploadToS3(file, fileName, res);
  });

  req.pipe(busboy);
});




/**
 * @swagger
 * /api/identify:
 *  post:
 *    description: Used to identify the user
 *    parameters:
 *      - name: image
 *        description: Image to upload for identification
 *        in: body
 *        required: true
 *      - name: idUser
 *        description: Id of the user
 *        in: body
 *        required: true
 *    responses:
 *      '200': 
 *        description: Image uploaded successfuly
 *      '400':
 *        description: Invalid parameters
 *      '404':
 *        description: Faces not matching
 */
app.post("/api/identify", (req, res) => {
  const { idUser:fileName } = req.body;
  if(!fileName) return res.status(400).send({ err: "Paramètres invalides -2" });
  var busboy = new Busboy({ headers: req.headers });
    
  // The file upload has completed
  busboy.on("finish", function () {
    console.log("Upload finished");
    
    // Grabs your file object from the request.
    if (!req.files || !req.files.image)
      return res.status(400).send({ err: "Paramètres invalides -1" });
    const { image: file } = req.files;

    console.log(file);
    let fileToCompare = "compare-"+fileName
    // Begins the upload to the AWS S3
    uploadToS3(file, fileToCompare,res,"compare");
  });


  req.pipe(busboy);
});

app.listen(process.env.PORT || 5000, () => console.log("listening on port 5000 ..."));
