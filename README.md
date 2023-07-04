This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, 
Ensure Redis is running. Change the URL, PORT for Redis

Second, run the development server:

```bash
npm run dev
```

To start NextJS
```
npm run start:nextjs
```

To start Server
```
npm run start:custom
```

Note Both Client and server will Start
If server fails to start
rerun the command

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
[http://localhost:3001](http://localhost:3000) for backend Services


## API routes
| Routes | Description |
| ----------- | ----------- |
| /api/health | returns "OK" |
| /api/latest | returns Latest Block |
| /api/blocks-default | returns the latest 25 blocks |
| api/blocks-timestamp/:oldtimestamp | returns all the blocks from latest block uptill the block having oldtimestamp|

Note
The frontend should send the oldtimestamp in UNIX format
