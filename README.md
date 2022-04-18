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

  - the first proto file passed in the arguments of the plugin will be the proto file used to generate the ABI output files
  - result messages must be name as `METHODNAME_result` (you can also provide a custom result by using the `@result` decorator. The custom result MUST be within the same proto file)
  - arguments messages must be name as `METHODNAME_arguments`
  - arguments messages must have a comment with the following information in it:
    - `@description` to indicate the ABI description for the method
    - `@read-only` to indicate the ABI read-only for the method

## Usage

```sh
protoc --plugin=protoc-gen-abi=./node_modules/.bin/koinos-abi-proto-gen --abi_out=. myProtoFile.proto

// you can generate the "authorize" entry point by setting the GENERATE_AUTHORIZE_ENTRY_POINT env variable
GENERATE_AUTHORIZE_ENTRY_POINT=1 protoc --plugin=protoc-gen-abi=./node_modules/.bin/koinos-abi-proto-gen --abi_out=. myProtoFile.proto koinos/chain/authority.proto
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

will generate the following ABI files:

A Koinos CLI compatible ABI file:
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
    "types": "ChBjYWxjdWxhdG9yLnByb3RvEgpjYWxjdWxhdG9yIisKDWFkZF9hcmd1bWVudHMSDAoBeBgBIAEoA1IBeBIMCgF5GAIgASgDUgF5IiIKCmFkZF9yZXN1bHQSFAoFdmFsdWUYASABKANSBXZhbHVlSqMCCgYSBAAADgEKCAoBDBIDAAASCggKAQISAwIAEwo8CgIEABIEBwAKARowIEBkZXNjcmlwdGlvbiBBZGQgdHdvIGludGVnZXJzCiBAcmVhZC1vbmx5IHRydWUKCgoKAwQAARIDBwgVCgsKBAQAAgASAwgCDgoMCgUEAAIABRIDCAIHCgwKBQQAAgABEgMICAkKDAoFBAACAAMSAwgMDQoLCgQEAAIBEgMJAg4KDAoFBAACAQUSAwkCBwoMCgUEAAIBARIDCQgJCgwKBQQAAgEDEgMJDA0KCgoCBAESBAwADgEKCgoDBAEBEgMMCBIKCwoEBAECABIDDQISCgwKBQQBAgAFEgMNAgcKDAoFBAECAAESAw0IDQoMCgUEAQIAAxIDDRARYgZwcm90bzM="
}
```

A Koilib compatible ABI file:
```json
{
    "methods": {
        "add": {
            "input": "calculator.add_arguments",
            "output": "calculator.add_result",
            "description": "Add two integers",
            "entryPoint": 2124307139,
            "readOnly": true
        }
    },
    "types": {
        "nested": {
            "calculator": {
                "nested": {
                    "add_arguments": {
                        "fields": {
                            "x": {
                                "type": "int64",
                                "id": 1
                            },
                            "y": {
                                "type": "int64",
                                "id": 2
                            }
                        }
                    },
                    "add_result": {
                        "fields": {
                            "value": {
                                "type": "int64",
                                "id": 1
                            }
                        }
                    }
                }
            }
        }
    }
}
```
