const NodeCache = require('node-cache')

const taskCache = new NodeCache({stdTTL: 600, checkperiod: 20});

//cache middleware for task retrieval
exports.cacheTask = (req, res, next) => {
    const taskId = req.params.id;
    const cachedTask = taskCache.get(taskId);

    if (cachedTask) {
        console.log('Cache hit for task', taskId);
        return res.json(cachedTask);
    }

    console.log('Cache miss for task', taskId);
    next();
};

//cache middle ware for tasklist, using query parameter as key
exports.cacheTaskList = (req, res, next) => {
    const cacheKey = `tasks-${JSON.stringify(req.query)}`;
    const cachedData = taskCache.get(cacheKey);

    if (cachedData) {
        console.log('Cache hit for task list');
        return res.json(cachedData);
    }

    console.log('Cache miss for task list');

    const originalJson = res.json;

    res.json = function(data){
        taskCache.set(cacheKey, data);

        return originalJson.call(this, data);
    };

    next();
};

//method to clear cache entries for a specific task
exports.clearCacheTask = (taskId) => {
    console.log('Clearing cache for task', taskId);
    taskCache.del(taskId);

    //clear all task list since they might contain this task
    const keys = taskCache.keys();
    keys.forEach(key => {
        if (key.startsWith('tasks-')) {
            taskCache.del(key);
        }
    });
};
