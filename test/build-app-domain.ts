import { unset } from 'lodash';
import { analyzeEntities, buildSchema } from 'oak-domain/src/compiler/schemalBuilder';

process.env.NODE_ENV = 'development';
analyzeEntities(`${__dirname}/../../oak-general-business/src/entities`);
buildSchema(`${__dirname}/app-domain/`);