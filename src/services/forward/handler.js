("use strict");

// Third party dependencies (Typically found in public NPM packages)
const ServerlessEmail = require("./ServerlessEmail");

module.exports.forward = async (event) => {
  const stage = event.queryStringParameters && event.queryStringParameters.stage ? event.queryStringParameters.stage : "dev";

  const options = {
    stage,
    fromEmail: process.env["VERIFIED_FROM_ADDRESS"],
    subjectPrefix: "",
    emailBucket: process.env["S3_BUCKET"],
    emailKeyPrefix: process.env["S3_EMAIL_PREFIX"],
    forwardTo: process.env["FORWARD_TO_ADDRESS"],
    subjectPrefix: process.env["SUBJECT_PREFIX"],
  };

  // Create an instance of the ServerlessEmail class
  const serverlessEmail = new ServerlessEmail(options);
  //await the result of forwarding the email
  const result = await serverlessEmail.forward(event);

  return result;
};
