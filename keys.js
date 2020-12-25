require("dotenv").config()
module.exports={
    BUCKET_NAME: "kalpay-faces",
    IAM_USER_KEY: process.env.USER_KEY,
    IAM_USER_SECRET: process.env.USER_SECRET,
    AWS_REGION: "us-east-2"
}

