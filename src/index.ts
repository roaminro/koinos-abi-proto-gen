// 
import {
  CodeGeneratorRequest,
  CodeGeneratorResponse,
} from "google-protobuf/google/protobuf/compiler/plugin_pb";
import * as fs from "fs";
import * as assert from "assert";
import * as crypto from "crypto";

// final ABI object that will be serialized
const ABI = {
  methods: {},
  types: '',
};

const input = fs.readFileSync(process.stdin.fd);

try {
  const codeGenRequest = CodeGeneratorRequest.deserializeBinary(input);
  const codeGenResponse = new CodeGeneratorResponse();

  // there should be only 1 proto file
  if (codeGenRequest.getFileToGenerateList().length !== 1) {
    throw new Error("Only 1 proto file can be used to generate an ABI");
  }

  codeGenResponse.setSupportedFeatures(
    CodeGeneratorResponse.Feature.FEATURE_PROTO3_OPTIONAL
  );

  // there can be only 1 ABI file to generate, 
  // so the first file to generate is always the one used to generate the ABI
  const protoFileName = codeGenRequest.getFileToGenerateList()[0];
  let protoFileDescriptor;

  // iterate over the proto files to find the one that will be used to generate the ABI
  for (const fileDescriptor of codeGenRequest.getProtoFileList()) {
    const fileDescriptorName = fileDescriptor.getName();
    assert.ok(fileDescriptorName);
    if (fileDescriptorName === protoFileName) {
      protoFileDescriptor = fileDescriptor;
      ABI.types = Buffer.from(fileDescriptor.serializeBinary()).toString('base64');
    }
  }

  if (!protoFileDescriptor) {
    throw new Error(`Could not find a fileDescriptor for ${protoFileName}`);
  }

  const protoPackage = protoFileDescriptor.getPackage();
  if (!protoPackage) {
    throw new Error(`Could not find a package in ${protoFileName}, this is required`);
  }

  const protoComments = new Map<string, string | undefined>();

  const sourceCodeInfo = protoFileDescriptor.getSourceCodeInfo();
  if (sourceCodeInfo) {
    for (const locationList of sourceCodeInfo.getLocationList()) {
      // the path to a comment is represented as:
      // the comment type: a message comment is always 4
      // the index of the message in the proto file, starting from 0
      const pathToComments = locationList.getPathList();
      if (locationList.getLeadingComments()) {
        protoComments.set(pathToComments.join('.'), locationList.getLeadingComments());
      }
    }
  }

  protoFileDescriptor.getMessageTypeList().forEach((messageDescriptor, index) => {
    const argumentsMessageName = messageDescriptor.getName();

    // only parse the messages ending with '_arguments'
    if (argumentsMessageName?.endsWith('_arguments')) {
      const ABIMethodName = argumentsMessageName.replace('_arguments', '');
      const resultMessageName = `${ABIMethodName}_result`;
      const commentsStr = protoComments.get(`4.${index}`);

      if (!commentsStr) {
        throw new Error(`Arguments Message "${argumentsMessageName}" is missing comments`);
      } 

      const comments = commentsStr.split('\n');
      let ABIDescritpion = '';
      let ABIReadOnly = '';
      comments.forEach(comment => {
        if (comment.includes('@description')) {
          ABIDescritpion = comment.replace('@description', '').trim();
        } else if (comment.includes('@read-only')) {
          ABIReadOnly = comment.replace('@read-only', '').trim();
        }
      });

      if (ABIDescritpion === '') {
        throw new Error(`Arguments Message "${argumentsMessageName}" is missing "@description" comment`);
      }

      if (ABIReadOnly === '') {
        throw new Error(`Arguments Message "${argumentsMessageName}" is missing "@read-only" comment`);
      }

      const ABIEntryPoint = `0x${crypto.createHash('sha256').update(ABIMethodName).digest('hex')}`.slice(0, 10);

      // @ts-ignore: using ABIMethodName as index of the object
      ABI.methods[ABIMethodName] = {
        argument: `${protoPackage}.${argumentsMessageName}`,
        return: `${protoPackage}.${resultMessageName}`,
        description: ABIDescritpion,
        entry_point: ABIEntryPoint,
        "read-only": ABIReadOnly === 'true'
      };
    }
  });

  const outputFile = new CodeGeneratorResponse.File();
  outputFile.setName(protoFileName.replace('.proto', '') + ".abi");
  outputFile.setContent(JSON.stringify(ABI, null, 4));
  codeGenResponse.addFile(outputFile);

  process.stdout.write(Buffer.from(codeGenResponse.serializeBinary().buffer));
} catch (error) {
  console.log("An error occurred in koinos-abi-proto-gen generator plugin.");
  console.error(error);
  process.exit(1);
}
