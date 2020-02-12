("use strict");

// System dependencies (Built in modules)
const path = require("path");

// Third party dependencies (Typically found in public NPM packages)
const AWS = require("aws-sdk");

// Project dependencies

// https://docs.aws.amazon.com/ses/latest/DeveloperGuide/receiving-email-action-lambda-event.html

/**
 * Wrapper around AWS SES and S3 to enable a developer-friendly basic email service for send/receive/forward
 *
 * @class ServerlessEmail
 */
class ServerlessEmail {
  constructor(options) {
    // Stage as in AWS Lambda definition of stage
    this.stage = options.stage || "dev";
    this.options = options;
  }

  /**
   * Forwards an SES received email to another email address
   *
   * @param {object} event: An incoming SES event. See tests/ses.json for an example.
   * @returns
   * @memberof ServerlessEmail
   */
  async forward(event) {
    try {
      let data = this.parseEvent(event);
      data = this.transformRecipients(data);
      data = await this.fetchMessage(data);
      data = this.processMessage(data);
      data = await this.sendMessage(data);
      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  /**
   * Parses an SES event into an email body and recipients
   *
   * @param {object} event: An SES event.
   * @returns
   * @memberof ServerlessEmail
   */
  parseEvent(event) {
    if (
      !event ||
      !event.hasOwnProperty("Records") ||
      event.Records.length !== 1 ||
      !event.Records[0].hasOwnProperty("eventSource") ||
      event.Records[0].eventSource !== "aws:ses" ||
      event.Records[0].eventVersion !== "1.0"
    ) {
      console.error("parseEvent", event);
      throw event;
    }

    const email = event.Records[0].ses.mail;
    const recipients = event.Records[0].ses.receipt.recipients;

    return { email, recipients };
  }

  /**
   * Sets up recipients so that we can reply in the forward
   *
   * @param {*} data
   * @returns
   * @memberof ServerlessEmail
   */
  transformRecipients(data) {
    data.originalRecipients = data.recipients;
    data.recipients = [this.options.forwardTo];
    return data;
  }

  async fetchMessage(data) {
    const s3 = new AWS.S3({ signatureVersion: "v4" });
    const key = path.join(this.options.emailKeyPrefix, data.email.messageId);
    const url = new URL(`s3://${this.options.emailBucket}`);

    url.pathname = key;

    console.log(`Fetching email at ${url.toString()}`);

    const params = {
      Bucket: this.options.emailBucket,
      Key: key,
    };

    try {
      data.emailData = (await s3.getObject(params).promise()).Body.toString();
      return data;
    } catch (err) {
      console.error("fetchMessage:", err);
      throw err;
    }
  }

  processMessage(data) {
    const options = this.options;
    var match = data.emailData.match(/^((?:.+\r?\n)*)(\r?\n(?:.*\s+)*)/m);
    var header = match && match[1] ? match[1] : data.emailData;
    var body = match && match[2] ? match[2] : "";

    // Add "Reply-To:" with the "From" address if it doesn't already exists
    if (!/^Reply-To: /im.test(header)) {
      match = header.match(/^From: (.*(?:\r?\n\s+.*)*\r?\n)/m);
      var from = match && match[1] ? match[1] : "";
      if (from) {
        header = header + "Reply-To: " + from;
        console.log("Added Reply-To address of: " + from);
      } else {
        console.log("Reply-To address not added because " + "From address was not properly extracted.");
      }
    }

    // SES does not allow sending messages from an unverified address,
    // so replace the message's "From:" header with the original
    // recipient (which is a verified domain)
    header = header.replace(/^From: (.*(?:\r?\n\s+.*)*)/gm, function(match, from) {
      var fromText;
      if (options.fromEmail) {
        fromText = "From: " + from.replace(/<(.*)>/, "").trim() + " <" + options.fromEmail + ">";
      } else {
        fromText = "From: " + from.replace("<", "at ").replace(">", "") + " <" + data.originalRecipient + ">";
      }
      return fromText;
    });

    // Add a prefix to the Subject
    if (options.subjectPrefix) {
      header = header.replace(/^Subject: (.*)/gm, function(match, subject) {
        return "Subject: " + options.subjectPrefix + subject;
      });
    }

    // Replace original 'To' header with a manually defined one
    if (options.forwardTo) {
      header = header.replace(/^To: (.*)/gm, () => "To: " + options.forwardTo);
    }

    // Remove the Return-Path header.
    header = header.replace(/^Return-Path: (.*)\r?\n/gm, "");

    // Remove Sender header.
    header = header.replace(/^Sender: (.*)\r?\n/gm, "");

    // Remove Message-ID header.
    header = header.replace(/^Message-ID: (.*)\r?\n/gim, "");

    // Remove all DKIM-Signature headers to prevent triggering an
    // "InvalidParameterValue: Duplicate header 'DKIM-Signature'" error.
    // These signatures will likely be invalid anyways, since the From
    // header was modified.
    header = header.replace(/^DKIM-Signature: .*\r?\n(\s+.*\r?\n)*/gm, "");

    data.emailData = header + body;
    return data;
  }

  /**
   *
   *
   * @param {*} data
   * @returns
   * @memberof ServerlessEmail
   */
  async sendMessage(data) {
    const ses = new AWS.SES({ apiVersion: "2010-12-01", region: "us-east-1" });

    var params = {
      Destinations: data.recipients,
      Source: data.originalRecipient,
      RawMessage: {
        Data: data.emailData,
      },
    };

    console.log(
      `sendMessage: Original recipients: ${data.originalRecipients.join(", ")}. Transformed recipients: ${data.recipients.join(
        ", "
      )} `
    );

    try {
      const result = await ses.sendRawEmail(params).promise();
      return result;
    } catch (err) {
      console.log(`sendRawEmail() returned error., error: ${err}, stack: ${err.stack}`);
      throw err;
    }
  }
}

module.exports = ServerlessEmail;
