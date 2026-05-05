#!/usr/bin/env node
'use strict';

const port = process.env.PORT || 8000;
const url = `http://localhost:${port}/health`;

require('http')
  .get(url, (res) => {
    process.exit(res.statusCode === 200 ? 0 : 1);
  })
  .on('error', () => {
    process.exit(1);
  });
