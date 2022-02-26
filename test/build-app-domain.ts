import buildSchema from 'oak-domain/src/compiler/schemalBuilder';

process.env.NODE_ENV = 'development';
process.env.IN_OAK_DOMAIN = 'yes';
buildSchema(`${__dirname}/../node_modules/oak-domain/src/entities`, `${__dirname}/app-domain/`);
process.env.IN_OAK_DOMAIN = undefined;