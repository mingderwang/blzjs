// Copyright (C) 2018 Bluzelle
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License, version 3,
// as published by the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.


const WebSocket = require('isomorphic-ws');
const assert = require('assert');
const bluzelle_pb = require('../proto/bluzelle_pb');
const database_pb = require('../proto/database_pb');
const status_pb = require('../proto/status_pb');


module.exports = class Connection {

    constructor({entry, log, onIncomingMsg}) {

        this.connection = new WebSocket(entry);

        this.connection.binaryType = 'arraybuffer';

        this.log = log;
        this.onIncomingMsg = onIncomingMsg;


        this.connection.onmessage = bin => {

            const actual_bin = Buffer.from(bin.data);

            this.log && logIncoming(actual_bin, this.log);

            this.onIncomingMsg(actual_bin);

        };

    }

    sendOutgoingMsg(bin) {

        if(this.connection.readyState === 1) {

            this.log && logOutgoing(bin, this.log);
            this.connection.send(bin);

        } else {

            // Send an error response, but not for status requests
            const bzn_envelope = bluzelle_pb.bzn_envelope.deserializeBinary(bin);

            if(bzn_envelope.hasDatabaseMsg()) {

                this.onIncomingMsg(connection_closed_error_response(bin));

            }

        }

    }

    close() {
        this.connection.close();
    }

};


const connection_closed_error_response = bin => {

    const bzn_envelope = bluzelle_pb.bzn_envelope.deserializeBinary(bin);


    const bzn_envelope_payload = bzn_envelope.getDatabaseMsg();

    const database_msg = database_pb.database_msg.deserializeBinary(bzn_envelope_payload);

    const header = database_msg.getHeader();


    const response = new database_pb.database_response();

    response.setHeader(header);

    const error = new database_pb.database_error();
    error.setMessage("CONNECTION NOT OPEN");

    response.setError(error);


    return response;

};


const logIncoming = (bin, log) => {

    const bzn_envelope = bluzelle_pb.bzn_envelope.deserializeBinary(new Uint8Array(bin));

    assert(bzn_envelope instanceof bluzelle_pb.bzn_envelope);

    assert(bzn_envelope.hasDatabaseResponse() || bzn_envelope.hasStatusResponse());


    if(bzn_envelope.hasDatabaseResponse()) {

        const database_response = database_pb.database_response.deserializeBinary(bzn_envelope.getDatabaseResponse());

        assert(database_response instanceof database_pb.database_response);

        // Make sure errors don't mess up this thread
        setTimeout(() => 
            log('Incoming database_response\n', filterUndefined(database_response.toObject())),
            0);

    }

    if(bzn_envelope.hasStatusResponse()) {

        const status_response = status_pb.status_response.deserializeBinary(bzn_envelope.getStatusResponse());

        assert(status_response instanceof status_pb.status_response);

        setTimeout(() => 
            log('Incoming status_response\n', filterUndefined(status_response.toObject())),
            0);

    }

};


const logOutgoing = (bin, log) => {

    const bzn_envelope = bluzelle_pb.bzn_envelope.deserializeBinary(bin);

    assert(bzn_envelope instanceof bluzelle_pb.bzn_envelope);

    assert(bzn_envelope.hasDatabaseMsg() || bzn_envelope.hasStatusRequest());


    if(bzn_envelope.hasDatabaseMsg()) {

        const database_msg = database_pb.database_msg.deserializeBinary(bzn_envelope.getDatabaseMsg());

        assert(database_msg instanceof database_pb.database_msg);


        setTimeout(() => 
            log('Outgoing database_msg\n', filterUndefined(database_msg.toObject())),
            0);

    }

    if(bzn_envelope.hasStatusRequest()) {

        const status_request = status_pb.status_request.deserializeBinary(bzn_envelope.getStatusRequest());

        assert(status_request instanceof status_pb.status_request);

        setTimeout(() => 
            log('Outgoing status_request\n', filterUndefined(status_request.toObject())),
            0);

    }

};


// Removes keys that map to undefined in an object,
// otherwise they show up in log output

const filterUndefined = obj => {

    const out = {};

    Object.keys(obj).
        filter(key => obj[key] !== undefined).
        forEach(key => out[key] = obj[key]);

    return out;

};