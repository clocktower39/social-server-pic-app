# Social-Picture-App

A full-stack mock social media application built with the MERN stack. This project is designed as a simplified, more intentional photo-sharing platform inspired by the earlier experience of Instagram, with a focus on chronological posts, real connections, direct messaging, and user-controlled social feeds.

## Project Vision

The goal of this project is to create a social media experience that feels more personal, focused, and user-controlled. Instead of emphasizing advertisements, algorithm-driven content, reposts, or endless scrolling, this app is centered around helping users see what their friends are sharing in a clear and chronological way.

The feed is designed to show posts in the order they were created, making it easy to understand who posted, what they shared, and when they shared it. This keeps the experience simple and transparent.

A key idea behind the app is giving users more control over the people and content they view. Users may be able to organize their feed into different groups, such as all followed users, close friends, family, or other custom groups. This allows the app to feel more personal and relevant rather than overwhelming.

The app also includes a messaging system so users can communicate directly with one another. Reposting is intentionally not a central feature of the platform. The focus is on original posts, personal updates, photos, and genuine interaction between users.

Overall, this project is intended to explore what a cleaner, friend-focused social platform could look like when the priority is connection rather than engagement loops.

## Features

Current and planned features include:

* User authentication with JWT
* User accounts and profile data
* Photo uploads and image storage
* Chronological post feed
* Direct messaging system
* Follow-based social feed
* Potential support for custom friend groups
* MERN stack architecture
* Separate frontend and backend applications
* Production deployment support

## Tech Stack

This project uses the following technologies:

* **MongoDB** — database
* **Express** — backend API framework
* **React** — frontend UI library
* **Node.js** — backend runtime
* **Vite** — frontend build tool
* **Material UI** — component styling and UI framework
* **Redux** — frontend state management
* **JWT** — authentication
* **GridFS** — image/file storage in MongoDB
* **Heroku** — backend hosting
* **Yarn** — package manager

## Project Structure

```txt
mock-instagram/
├── social-picture-app/        # React + Vite frontend
└── social-server-pic-app/     # Express + Mongoose backend
```

### Frontend

The frontend is located in:

```txt
social-picture-app/
```

It is built with React, Vite, Material UI, and Redux. The frontend handles the user interface, client-side routing, authentication state, feed display, messaging UI, and communication with the backend API.

### Backend

The backend is located in:

```txt
social-server-pic-app/
```

It is built with Express, Node.js, MongoDB, Mongoose, JWT authentication, and GridFS. The backend handles API routes, authentication, database operations, image storage, and server-side application logic.

## Local Development

To run the project locally, start both the backend and frontend applications.

### 1. Start the backend

```bash
cd social-server-pic-app
yarn install
yarn dev
```

The backend runs on:

```txt
http://localhost:3003
```

### 2. Start the frontend

Open a second terminal window and run:

```bash
cd social-picture-app
yarn install
yarn dev
```

The frontend runs on:

```txt
http://localhost:5173
```

The frontend is configured to auto-detect the backend on the same host using port `3003`.

## Deployment

The project is split into two deployable parts:

1. A static frontend application
2. A backend API server

### Frontend Deployment

The frontend is built as a static single-page application and can be hosted on any static hosting provider, including:

* Apache
* Nginx
* Netlify
* Vercel
* GitHub Pages
* Shared hosting providers
* Any static file host

To build the frontend for production:

```bash
cd social-picture-app
yarn build
```

The production build output will be generated in the frontend build directory.

### Backend Deployment

The backend is hosted on Heroku by default.

Default production backend URL:

```txt
https://social-picture-app.herokuapp.com
```

When the frontend is built in production mode, the backend URL is automatically set to the Heroku backend unless overridden with an environment variable.

## Frontend Environment Variables

To override the backend API URL during production builds, set the `VITE_API_URL` environment variable.

Example using a `.env.production` file:

```bash
cd social-picture-app
echo "VITE_API_URL=https://api.your-domain.com" > .env.production
yarn build
```

Or pass it inline:

```bash
cd social-picture-app
VITE_API_URL=https://api.your-domain.com yarn build
```

The `.env.example` file should list the available frontend configuration options.

## Backend Environment Variables

The backend requires the following environment variables.

For Heroku, set these in the app’s config vars:

```env
DBURL=<mongodb connection string>
ACCESS_TOKEN_SECRET=<random secret>
REFRESH_TOKEN_SECRET=<random secret>
SALT_WORK_FACTOR=10
PORT=8080
```

### Environment Variable Notes

| Variable               | Description                         |
| ---------------------- | ----------------------------------- |
| `DBURL`                | MongoDB connection string           |
| `ACCESS_TOKEN_SECRET`  | Secret used to sign access tokens   |
| `REFRESH_TOKEN_SECRET` | Secret used to sign refresh tokens  |
| `SALT_WORK_FACTOR`     | bcrypt password hashing cost factor |
| `PORT`                 | Backend server port                 |

## CORS

The backend currently uses:

```js
app.use(cors())
```

This allows requests from all origins. This is useful during development and for testing deployments where the frontend may be hosted separately from the backend.

For a production application, CORS should be restricted to trusted frontend domains.

## Authentication

Authentication is handled with JSON Web Tokens. The backend uses access and refresh token secrets to manage authenticated user sessions.

This project was built as a mock application and testing project, so authentication behavior should be reviewed and hardened before using similar patterns in a production application.

## Image Storage

Image uploads are handled with GridFS, allowing uploaded photos and files to be stored in MongoDB.

This supports the photo-sharing functionality of the app while keeping file storage connected to the database layer.

## Project Status

This is a mock/testing project and is not intended to be a production social media platform in its current form.

The project is useful for experimenting with:

* Full-stack MERN architecture
* Authentication flows
* Image uploads
* Social feed design
* Messaging features
* Frontend/backend separation
* Deployment workflows

## Future Improvements

Potential future improvements include:

* Custom friend groups
* Improved profile pages
* Better messaging UI
* Notifications
* Feed filtering by group
* Improved image optimization
* Stronger production security settings
* More polished responsive design
* API documentation
* Testing setup
* Better error handling
* More complete deployment documentation

## Purpose

This project was created to explore a simpler and more intentional version of a social media application. The main focus is not to maximize screen time, but to build a clean, chronological, friend-centered photo-sharing experience.
