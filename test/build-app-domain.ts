import { analyzeEntities, buildSchema } from 'oak-domain/src/compiler/schemalBuilder';

process.env.NODE_ENV = 'development';

analyzeEntities(`${__dirname}/entities`);
buildSchema(`${__dirname}/app-domain/`);