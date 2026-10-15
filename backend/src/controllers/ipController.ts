import express from "express";
import IPService from "../services/ipService";

const ipController = express.Router()

const ipService = new IPService();

ipController.get('/', (req, res) => {

    ipService.getPublicIpAddress()
        .then(respJ => res.json({serverIP: respJ}))
        .catch(err => res.status(404).json({serverIP: err}));

});

export default ipController;