# Apollo Server with Express, React, and MongoDB

This started as a school project for learning GraphQL and turned into the backend for my webapp. It is built by me for learning purposes.

## What does it do?

This project is a TypeScript application that sets up an Apollo Server using Express.js. It routes traffic between a React frontend (https://github.com/MiroMuro/BAfront) and a MongoDB database, allowing for seamless data querying and mutation through GraphQL.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Folder Structure](#folder-structure)
- [Contributing](#contributing)
- [License](#license)

## Features

- Apollo Server setup with Express.js
- TypeScript for type safety and better development experience
- React frontend integration
- MongoDB for database operations
- Mongoose for MongoDB data modeling
- GraphQL for efficient data fetching
- ESLint and Prettier for coherent code

## Installation

### Prerequisites

- Node.js
- npm or yarn
- MongoDB Atlas account

### Setting Up MongoDB Atlas

1. **Sign Up for MongoDB Atlas**:

   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up for a free account.

2. **Create a Cluster**:

   - After signing in, click on "Build a Cluster".
   - Select your preferred cloud provider and region. The free tier options are usually sufficient for development purposes.
   - Click "Create Cluster". This may take a few minutes.

3. **Set Up Cluster Security**:

   - **Whitelist Your IP Address**:
     - Go to the "Network Access" tab.
     - Click on "Add IP Address" and enter your current IP address or allow access from anywhere (0.0.0.0/0).
   - **Create a Database User**:
     - Go to the "Database Access" tab.
     - Click on "Add New Database User".
     - Enter a username and password. Make sure to save these credentials as you will need them later.

4. **Get the Connection String**:
   - Go to the "Clusters" tab.
   - Click on the "Connect" button for your cluster.
   - Choose "Connect your application".
   - Copy the provided connection string. It will look something like this:
     ```
     mongodb+srv://<username>:<password>@cluster0.mongodb.net/myFirstDatabase?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with the credentials you created earlier.

### Installation Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/MiroMuro/BAbackend.git
   cd BAbackend

   ```

2. **Install the dependencies**
   ```bash
   npm install
   ```
3. **Set up environment variables**
   ```bash
   MONGODB_URI=your-mongodb-uri-created-in-setting-up-mongodb-atlas
   JWT_SECRET=your-secret-here
   PORT=your-port-here
   ```
4. **Start the development server**
   ```bash
   npm start
   ```

## Usage

- Start the server: `npm start`
- Access the Apollo Server playground at `http://localhost:<PORT>`
- Interact with the React frontend at `http://localhost:<PORT>`## Configuration

Configure the following environment variables in your `.env` file:

- `MONGODB_URI`: URI of your MongoDB instance from MongoDB Atlas
- `PORT`: Port number for the Express server (default is 4000)
- `JWT_SECRET`: Secret used for jwt signing the authorization header.

## Folder structure

```
.
└── BAback/
    ├── dist/
    │   └── index.js
    ├── src/
    │   ├── models/
    │   │   ├── Author.js
    │   │   ├── Books.js
    │   │   └── User.js
    │   ├── index.ts
    │   ├── resolver.ts
    │   └── schema.js
    ├── .gitignore
    ├── .env
    ├── package-lock.json
    ├── package.json
    ├── README.md
    └── tsconfig.json
```
## Hosting
This backend is currently being hosted online at https://baback.onrender.com/
