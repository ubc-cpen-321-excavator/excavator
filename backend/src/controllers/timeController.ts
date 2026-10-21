import express from "express";
import TimeService from "../services/timeService";

const timeController = express.Router()

const timeService = new TimeService();

timeController.get('/', (req, res) => {
    res.json({time:timeService.getTime()})
});

export default timeController;