const Task = require('../model/task.js');
const {validationResult} = require('express-validator');
const mongoose = require('mongoose')

// Helper function to detect circular dependency
async function detectCircularDependency(taskId, dependencyId, visited = new Set()) {
    if (taskId.toString() === dependencyId.toString())
        return true;
    if (visited.has(dependencyId.toString()))
        return false;

    visited.add(dependencyId.toString());

    const dependency = await Task.findById(dependencyId);
    if (!dependency)
        return false;

    for (const depId of dependency.dependencies){
        if (await detectCircularDependency(taskId, depId, visited)) {
            return true;
        }
    }

    return false;
}

// Get all dependencies of a task
async function getAllDependencies(taskId, dependencies = new Set(), level = 0) {
    const task = await Task.findById(taskId).populate('dependencies');

    if (!task || !task.dependencies.length)
        return dependencies;

    for (const dep of task.dependencies){
        const depInfo = {
            id: dep._id,
            title: dep.title,
            status: dep.status,
            level: level + 1
        }

        //Only add if not already in the set (avoid duplications)
        if (!Array.from(dependencies).some(d => d.id.toString() === depInfo.id.toString())){
            dependencies.add(depInfo);
            //REcursively get dependencies of this dependency
            await getAllDependencies(dep._id, dependencies, level + 1);
        }
    }

    return dependencies
}

//Create a new task
exports.createTask = async (req, res) => {
    try {
        const errors = validationResult(req);
        if(!errors.isEmpty()){
            return res.status(400).json({ errors: errors.array()});
        }
    

    const { title, description, dueDate, priority, dependencies } = req.body;
    // Create new task without dependencies
    const newTask = new Task({
        title,
        description,
        dueDate,
        priority
    });
    //save task to get ID
    await newTask.save();

    //Add dependencies if provided
    if (dependencies && dependencies.length > 0){
        //Validate each dependency
        for (const depId of dependencies){
            // CHeck if dependency exists
            const depExists = await Task.findById(depId);
            if (!depExists){
                return res.status(400).json({ message: `Dependency task with ID ${depId} not found!`})
            }

            // Check if circular dependency exist
            const isCircular = await detectCircularDependency(newTask._id, depId);
            if (isCircular) {
                await Task.findByIdAndDelete(newTask._id);
                return res.status(400).json({ message: `Circular dependency detected!`});
            }
        }

        // If all dependencies are valid, add them
        newTask.dependencies = dependencies;
        await newTask.save();
    }

    res.status(201).json(newTask);
    }

    catch (err) {
        res.status(500).json({message: 'Server Error', error: err.message});
    }
};

//Get all task with filtering and pagination
exports.getAllTasks = async( req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            priority,
            dueBefore,
            dueAfter,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        //build filter object
        const filter = {};
        if (status) 
            filter.status = status;
        if (priority)
            filter.priority = priority;

        //date filtering
        if (dueBefore || dueAfter) {
            filter.dueDate = {};
            if (dueBefore)
                filter.dueDate.$lte = new Date(dueBefore);
            if (dueAfter)
                filter.dueDate.$gte = new Date(dueAfter);
        }

        //parse pagination parameters
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        //buidl sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        //execute query with pagination
        const tasks =  await Task.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .populate('dependencies', 'title status');

        //get total count for pagination metadata
        const totalTasks = await Task.countDocuments(filter);

        res.json({
            tasks,
            pagination: {
                total: totalTasks,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(totalTasks / limitNum)
            }
        });
    }
    catch (err) {
        res.status(500).json({message: 'Server error', error: err.message});
    }
};

// get a task by ID
exports.getTaskById = async( req, res) => {
    try {
        const task = await Task.findById(req.params.id).populate('dependencies', 'title status');

        if (!task) {
            return res.status(404).json({message: 'Task not found'});
        }

        res.json(task);
    }
    catch (err) {
        res.status(500).json({ message:'Server error', error: err.message});
    }
};

//update a task
exports.updateTask = async(req, res) => {
    try {
        const {title, description, dueDate, priority, status, dependencies } = req.body;

        //Find task to update
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({message: 'Task not found'});
        }

        //update basic fields
        if (title) task.title = title;
        if (description) task.description = description;
        if (dueDate) task.dueDate = dueDate;
        if (priority) task.priority = priority;
        if (status) task.status = status;

        if (dependencies) {
            for (const depId of dependencies) {
              const depExists = await Task.findById(depId);
              if (!depExists) {
                return res.status(404).json({ message: `Dependency task with ID ${depId} not found` });
              }
              
              const isCircular = await detectCircularDependency(task._id, depId);
              if (isCircular) {
                return res.status(400).json({ message: 'Circular dependency detected' });
              }
            }
            
            // If all dependencies are valid, update them
            task.dependencies = dependencies;
        }
        await task.save()
        res.json(task)
    }
    catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message})
    }
};

//delete a task
exports.deleteTask = async(req, res) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task){
            return res.status(404).json({ message: 'Task not found'});
        }

        const dependentTask = await Task.find({dependencies: req.params.id});

        if (dependentTask.length > 0){
            for (const depTask of dependentTask) {
                depTask.dependencies = depTask.dependencies.filter(
                    dep => dep.toString() !== req.params.id
                );
                await depTask.save();
            }
        } 
        await Task.findByIdAndDelete(req.params.id)
        res.json({ message: 'Task deleted successfully'});
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

//add a dependency to a task
exports.addDependency = async (req, res) => {
    try {
        const { taskId, dependencyId } = req.params;
        
        // Validate both tasks exist
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        const dependency = await Task.findById(dependencyId);
        if (!dependency) {
            return res.status(404).json({ message: 'Dependency task not found' });
        }
        
        // Check if dependency already exists
        if (task.dependencies.includes(dependencyId)) {
            return res.status(400).json({ message: 'Dependency already exists' });
        }
        
        // Check for circular dependency
        const isCircular = await detectCircularDependency(taskId, dependencyId);
        if (isCircular) {
            return res.status(400).json({ message: 'Circular dependency detected' });
        }
        
        // Add dependency
        task.dependencies.push(dependencyId);
        await task.save();
        
        res.json(task);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
  
// Remove a dependency from a task
exports.removeDependency = async (req, res) => {
    try {
        const { taskId, dependencyId } = req.params;
        
        // Validate task exists
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        // Check if dependency exists in task
        if (!task.dependencies.some(dep => dep.toString() === dependencyId)) {
            return res.status(400).json({ message: 'Dependency not found in this task' });
        }
        
        // Remove dependency
        task.dependencies = task.dependencies.filter(
            dep => dep.toString() !== dependencyId
        );
        
        await task.save();
        res.json(task);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
  
// Get all dependencies for a task (direct and indirect)
exports.getAllDependencies = async (req, res) => {
    try {
        const { taskId } = req.params;
        
        // Validate task exists
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        // Get all dependencies
        const dependencies = await getAllDependencies(taskId);
        
        // Convert Set to Array and sort by level
        const dependenciesArray = Array.from(dependencies).sort((a, b) => a.level - b.level);
        
        // Group by levels
        const dependenciesByLevel = dependenciesArray.reduce((acc, dep) => {
            if (!acc[dep.level]) acc[dep.level] = [];
            acc[dep.level].push({
            id: dep.id,
            title: dep.title,
            status: dep.status
            });
            return acc;
        }, {});
        
        res.json({
            task: {
            id: task._id,
            title: task.title
            },
            directDependencies: dependenciesByLevel[1] || [],
            allDependencies: dependenciesArray,
            dependenciesByLevel
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
  