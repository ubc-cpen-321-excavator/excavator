import express from "express";
import NameService from "../services/nameService";

const nameController = express.Router()

const nameService = new NameService();

nameController.get('/', (req, res) => {
    res.json({name: nameService.getFullName()})
});

export default nameController;