import express from "express";
import IPService from "../services/ipService";

const ipController = express.Router()

const ipService = new IPService();

ipController.get('/', (req, res) => {

    ipService.getPublicIpAddress()
        .then(respJ => res.json({serverIP: respJ}))
        .catch((err: unknown) => res.status(404).json({serverIP: String(err)}));

});

export default ipController;