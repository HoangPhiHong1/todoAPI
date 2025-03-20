# TODO API


## Features

1. Task management: Create, read, update and delete tasks.
2. Task dependencies: Add and remove dependencies between tasks, with circular dependency detection.
3. Filtering and pagination: Retrieve tasks with filter (i.e., status, priority) and pagination.
4. Caching: Using **node-cache** for in-memory caching in order to improve performance.
5. Validation: Using **express-validator** to ensure that input data is valid.

## Installation

1. Clone the Repo
2. Install the dependencies: npm install 
> [!IMPORTANT]
> 3. Set up environment variables:\
>   -> Create a .env file in root directory\
>   -> Add the following:\
>      *PORT=3000* \
>      *MONGODB_URI=mongodb://127.0.0.1:27017/todo-app*\
>   -> **If using a remote database, replace MONGODB_URI with your MongoDB connection**  \
> 4. Finally, start your MongoDB

## Running

*Development mode*: npm run dev\
*Production mode*: npm start 
> [!TIP]
> ***The API will run on http://localhost:3000 (or the PORT specified in .env)***

   
