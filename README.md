# koinos-abi-proto-gen
This is a `protoc` plugin to generate an Koinos compatible ABI file from a proto file.

## Installation
```sh
# with npm
npm install --save-dev koinos-abi-proto-gen

# with yarn
yarn add --dev koinos-abi-proto-gen
```

## Important note
The plugin will generate an ABI method entry for all messages that follow the following rules:

  - result messages must be name as `METHODNAME_result`
  - arguments messages must be name as `METHODNAME_arguments`
  - arguments messages must have a comment with the following information in it:
    - `@description` to indicate the ABI description for the method
    - `@read-only` to indicate the ABI read-only for the method

## Usage

```sh
protoc --plugin=protoc-gen-abi=./node_modules/.bin/koinos-abi-proto-gen --abi_out=. myProtoFile.proto
```

## Example
The following proto file:
```proto
syntax = "proto3";

package calculator;

// @description Add two integers
// @read-only true
message add_arguments {
  int64 x = 1;
  int64 y = 2;
}

message add_result {
  int64 value = 1;
}
```

will generate the following ABI file:
```json
{
    "methods": {
        "add": {
            "argument": "calculator.add_arguments",
            "return": "calculator.add_result",
            "description": "Add two integers",
            "entry_point": "0x7e9e5ac3",
            "read-only": true
        }
    },
    "types": "CipjYWxjdWxhdG9yL2Fzc2VtYmx5L3Byb3RvL0NhbGN1bGF0b3IucHJvdG8SCmNhbGN1bGF0b3IiKwoNYWRkX2FyZ3VtZW50cxIMCgF4GAEgASgDUgF4EgwKAXkYAiABKANSAXkiIgoKYWRkX3Jlc3VsdBIUCgV2YWx1ZRgBIAEoA1IFdmFsdWVKowIKBhIEAAAOAQoICgEMEgMAABIKCAoBAhIDAgATCjwKAgQAEgQHAAoBGjAgQGRlc2NyaXB0aW9uIEFkZCB0d28gaW50ZWdlcnMKIEByZWFkLW9ubHkgdHJ1ZQoKCgoDBAABEgMHCBUKCwoEBAACABIDCAIOCgwKBQQAAgAFEgMIAgcKDAoFBAACAAESAwgICQoMCgUEAAIAAxIDCAwNCgsKBAQAAgESAwkCDgoMCgUEAAIBBRIDCQIHCgwKBQQAAgEBEgMJCAkKDAoFBAACAQMSAwkMDQoKCgIEARIEDAAOAQoKCgMEAQESAwwIEgoLCgQEAQIAEgMNAhIKDAoFBAECAAUSAw0CBwoMCgUEAQIAARIDDQgNCgwKBQQBAgADEgMNEBFiBnByb3RvMw=="
}
```
