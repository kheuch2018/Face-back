const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const Busboy = require("busboy");
const AWS = require("aws-sdk");
var fileupload = require("express-fileupload");
const keys = require("./keys")


AWS.config.region = keys.AWS_REGION;
AWS.config.accessKeyId = keys.IAM_USER_KEY;
AWS.config.secretAccessKey = keys.IAM_USER_SECRET;


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
      servers: ["http://localhost:5000"]
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
let s3bucket = new AWS.S3({
  accessKeyId: keys.IAM_USER_KEY,
  secretAccessKey: keys.IAM_USER_SECRET,
  Bucket: keys.BUCKET_NAME,
});
var params = {
  Bucket: keys.BUCKET_NAME,
  Key: "",
  Body: "",
};

function uploadToS3(userImage, idImage, fileName, res) {
  s3bucket.createBucket(function () {
    params.Key=fileName
    params.Body=userImage.data
    s3bucket.upload(params, function (err, data) {
      if (err) {
        res.status(400).send({ err, code: 2 });
      }
     console.log("upload 1 succeed")

      
      detectFaces(res,fileName,idImage)

      
    })
  })
}

let detectFaces = (res, fn,idImage) => {
  const client = new AWS.Rekognition();
  const params2 = {
    Image: {
      S3Object: {
        Bucket: "kalpay-faces",
        Name: fn
      },
    },
    Attributes: ['ALL']
  }
  
  client.detectFaces(params2,(err,response) => {
    if(err) return res.status(400).send({err: "No face detected", code: 3 })
    // console.log("eyes",response.FaceDetails[0].EyesOpen)
    console.log("smile",response.FaceDetails[0].Smile)
    // return res.send(response)
    if(response.FaceDetails && 
     response.FaceDetails[0].Smile && 
     response.FaceDetails[0].Smile.Value 
      // && 
      // !response.FaceDetails[0].EyesOpen.Value 
      ) {
     console.log("Face is detected")
        
        s3bucket.createBucket(function () {
           params.Key="compare"+fn
           params.Body=idImage.data
          s3bucket.upload(params, function (err, data) {
            if (err) {
              console.log("error in callback");
              console.log(err);
              res.status(400).send({ err, code: 4 });
            }
            console.log("Upload 2 succeed")
            compareFaces(res,fn)
            
            // if(type!=="compare") return res.send({ success: "Face correct" });
            
          })
        })


        return
      }

    else
    return res.status(400).send({err: "Invalid Face", code: 5 })
  })
}

let compareFaces = (res,fileName) => {
    const client = new AWS.Rekognition();
  const Myparams = {
    SourceImage: {
      S3Object: {
        Bucket: keys.BUCKET_NAME,
        Name: "compare"+fileName,
      },
    },
    TargetImage: {
      S3Object: {
        Bucket: keys.BUCKET_NAME,
        Name: fileName,
      },
    },
    // SimilarityThreshold: 70,
  };

  client.compareFaces(Myparams, (err, response) => {
    if (err) {
      console.log(err, err.stack); // an error occurred
      res.status(400).send({ err, code: 6 });
    } else {
      console.log("Faces compared");
      response.FaceMatches.forEach((data) => {
        let position = data.Face.BoundingBox;
        let similarity = data.Similarity;
        console.log(
          `The face at: ${position.Left}, ${position.Top} matches with ${similarity} % confidence`
        );
        res.send({ success: { confidence: similarity } });
      }); // for response.faceDetails

      response.UnmatchedFaces.forEach((data) => {
        res.status(404).send({err: "Faces not matching", code: 7 });
      })
    } 
  });
}


/**
 * @swagger
 * /api/identify:
 *  post:
 *    description: Used to identify the user
 *    parameters:
 *      - name: idImage
 *        description: Image of the CNI/Passport or other id document
 *        in: body
 *        required: true
 *      - name: userImage
 *        description: Image of the user smiling
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
  if(!fileName) return res.status(400).send({ err: "Paramètres invalides ",code: 0 });
  var busboy = new Busboy({ headers: req.headers });
    
  // The file upload has completed
  busboy.on("finish", function () {
    console.log("Upload finished");
    
    // Grabs your file object from the request.
    if (!req.files || !req.files.userImage || !req.files.idImage)
      return res.status(400).send({ err: "Paramètres invalides ", code: 1 });
    const { userImage,idImage } = req.files;

    // Begins the upload to the AWS S3

    uploadToS3(userImage,idImage, fileName,res);
  });


  req.pipe(busboy);
});

const port = process.env.PORT || 5000

app.listen(port, () => console.log(`listening on port ${port} ...`));
