const express = require('express');
const router = express.Router();
const {body} = require('express-validator');
const taskController = require('../controllers/taskController');

const validateTaskInput = [
    body('title').notEmpty().withMessage('Title is required'),
    body('priority').optional().isIn(['low','medium','high']).withMessage('Priority must be low, medium or high'),
    body('status').optional().isIn(['todo', 'in-progress', 'completed']).withMessage('Status must be todo, in-progress or completed'),
    body('dueDate').optional().isISO8601().withMessage('Invalid date format')
];

router.post('/',validateTaskInput, taskController.createTask);
router.get('/',taskController.getAllTasks);
router.get('/:id', taskController.getTaskById);
router.put('/:id', validateTaskInput, taskController.updateTask);
router.delete('/:id', taskController.deleteTask)


router.post('/:taskId/dependencies/:dependencyId', taskController.addDependency);
router.delete('/:taskId/dependencies/:dependencyId', taskController.removeDependency);
router.get('/:taskId/dependencies', taskController.getAllDependencies)

module.exports = router
