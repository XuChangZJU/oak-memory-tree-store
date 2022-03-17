import { unset } from 'lodash';
import { analyzeEntities, buildSchema } from 'oak-domain/src/compiler/schemalBuilder';

process.env.NODE_ENV = 'development';
process.env.COMPILING_BASE_DOMAIN = 'yes';
analyzeEntities(`${__dirname}/../node_modules/oak-domain/src/entities`);
unset(process.env, 'COMPILING_BASE_DOMAIN');
buildSchema(`${__dirname}/app-domain/`);
process.env.IN_OAK_DOMAIN = undefined;