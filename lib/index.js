"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
//
const plugin_pb_1 = require("google-protobuf/google/protobuf/compiler/plugin_pb");
const fs = __importStar(require("fs"));
const assert = __importStar(require("assert"));
const crypto = __importStar(require("crypto"));
const path = __importStar(require("path"));
const pbjs = __importStar(require("protobufjs/cli/pbjs"));
const child_process_1 = require("child_process");
const { GENERATE_AUTHORIZE_ENTRY_POINT } = process.env;
// final ABI object that will be serialized
const ABI = {
    methods: {},
    types: '',
};
// final json ABI object that will be serialized
const jsonABI = {
    methods: {},
    types: '',
};
const generateBinaryFileDescriptor = (abiFileName, protoFilesPaths) => {
    const pbFilePath = `./${abiFileName}.pb`;
    const protocCmd = `protoc --descriptor_set_out=${pbFilePath} ${protoFilesPaths.join(' ')}`;
    (0, child_process_1.execSync)(protocCmd);
    const binaryFileDescriptor = fs.readFileSync(pbFilePath);
    return binaryFileDescriptor.toString('base64');
};
const generateJsonFileDescriptor = async (protoFilesPaths) => {
    return new Promise((resolve, reject) => {
        pbjs.main(["--target", "json", ...protoFilesPaths], (err, output) => {
            if (err)
                reject(err);
            if (output) {
                resolve(output);
            }
            else {
                resolve("");
            }
        });
    });
};
(async () => {
    const input = fs.readFileSync(process.stdin.fd);
    try {
        const codeGenRequest = plugin_pb_1.CodeGeneratorRequest.deserializeBinary(input);
        const codeGenResponse = new plugin_pb_1.CodeGeneratorResponse();
        codeGenResponse.setSupportedFeatures(plugin_pb_1.CodeGeneratorResponse.Feature.FEATURE_PROTO3_OPTIONAL);
        const protoFileNames = codeGenRequest.getFileToGenerateList();
        // there can be only 1 ABI file to generate,
        // so the first file to generate is always the one used to generate the ABI
        const abiProtoFileName = protoFileNames[0];
        const abiFileName = path.parse(abiProtoFileName).base.replace(".proto", "");
        let protoFileDescriptor;
        // iterate over the proto files to find the one that will be used to generate the ABI
        for (const fileDescriptor of codeGenRequest.getProtoFileList()) {
            const fileDescriptorName = fileDescriptor.getName();
            assert.ok(fileDescriptorName);
            if (protoFileNames.includes(fileDescriptorName)) {
                if (fileDescriptorName === abiProtoFileName) {
                    protoFileDescriptor = fileDescriptor;
                }
            }
        }
        if (!protoFileDescriptor) {
            throw new Error(`Could not find a fileDescriptor for ${abiProtoFileName}`);
        }
        const protoPackage = protoFileDescriptor.getPackage();
        if (!protoPackage) {
            throw new Error(`Could not find a package in ${abiProtoFileName}, this is required`);
        }
        const protoComments = new Map();
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
        const messageDescriptors = protoFileDescriptor.getMessageTypeList();
        for (let index = 0; index < messageDescriptors.length; index++) {
            const messageDescriptor = messageDescriptors[index];
            const argumentsMessageName = messageDescriptor.getName();
            // only parse the messages ending with '_arguments'
            if (argumentsMessageName?.endsWith('_arguments')) {
                const ABIMethodName = argumentsMessageName.replace('_arguments', '');
                let resultMessageName = `${ABIMethodName}_result`;
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
                    }
                    else if (comment.includes('@read-only')) {
                        ABIReadOnly = comment.replace('@read-only', '').trim();
                    }
                    else if (comment.includes('@result')) {
                        resultMessageName = comment.replace('@result', '').trim();
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
                    "entry-point": ABIEntryPoint,
                    "read-only": ABIReadOnly === 'true'
                };
                // @ts-ignore: using ABIMethodName as index of the object
                jsonABI.methods[ABIMethodName] = {
                    argument: `${protoPackage}.${argumentsMessageName}`,
                    return: `${protoPackage}.${resultMessageName}`,
                    description: ABIDescritpion,
                    entry_point: parseInt(ABIEntryPoint, 16),
                    read_only: ABIReadOnly === 'true'
                };
                // if need to generate authorize entry point
                if (GENERATE_AUTHORIZE_ENTRY_POINT) {
                    const authorizeABIEntryPoint = `0x${crypto.createHash('sha256').update('authorize').digest('hex')}`.slice(0, 10);
                    // @ts-ignore: using ABIMethodName as index of the object
                    jsonABI.methods['authorize'] = {
                        argument: 'koinos.chain.authorize_arguments',
                        return: 'koinos.chain.authorize_result',
                        description: 'Check if authorized',
                        entry_point: parseInt(authorizeABIEntryPoint, 16),
                        read_only: false
                    };
                }
                ABI.types = generateBinaryFileDescriptor(abiFileName, protoFileNames);
                const jsonDescriptor = await generateJsonFileDescriptor(protoFileNames);
                jsonABI.types = JSON.parse(jsonDescriptor);
            }
        }
        const outputFileName = `${abiFileName}.abi`;
        const outputFile = new plugin_pb_1.CodeGeneratorResponse.File();
        outputFile.setName(outputFileName);
        outputFile.setContent(JSON.stringify(ABI, null, 4));
        codeGenResponse.addFile(outputFile);
        const jsonOutputFileName = `${abiFileName}-abi.json`;
        const jsonOutput = new plugin_pb_1.CodeGeneratorResponse.File();
        jsonOutput.setName(jsonOutputFileName);
        jsonOutput.setContent(JSON.stringify(jsonABI, null, 4));
        codeGenResponse.addFile(jsonOutput);
        process.stdout.write(Buffer.from(codeGenResponse.serializeBinary().buffer));
    }
    catch (error) {
        console.log("An error occurred in koinos-abi-proto-gen generator plugin.");
        console.error(error);
        process.exit(1);
    }
})();
