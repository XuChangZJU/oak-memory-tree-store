import { v4 } from 'uuid';
import { describe, it } from 'mocha';
import TreeStore from '../src/store';
import { EntityDict } from './app-domain/EntityDict';
import { storageSchema } from './app-domain/Storage';
import assert from 'assert';
import { CreateSingleOperation } from './app-domain/System/Schema';
import { UniversalContext } from 'oak-domain/lib/store/UniversalContext';

describe('基础测试', function () {
    this.timeout(1000000);

    it('[1.0]简单查询', async () => {
        const store = new TreeStore<EntityDict, UniversalContext<EntityDict>>(storageSchema);
        const context = new UniversalContext(store);
        const created = await store.operate('application', {
            action: 'create',
            data: [{
                id: 'aaa',
                name: 'test',
                description: 'ttttt',
                type: 'web',
                system: {
                    action: 'create',
                    data: {
                        id: 'bbb',
                        name: 'systest',
                        description: 'aaaaa',
                        config: {},
                    } as CreateSingleOperation['data']
                },
            }, {
                id: 'aaa2',
                name: 'test2',
                description: 'ttttt2',
                type: 'web',
                system: {
                    action: 'create',
                    data: {
                        id: 'ccc',
                        name: 'systest2',
                        description: 'aaaaa2',
                        config: {},
                    }
                }
            }]
        }, context);

        console.log(created);

        const applications = await store.select('application', {
            data: {
                id: 1,
                name: 1,
                systemId: 1,
                system: {
                    id: 1,
                    name: 1,
                }
            },
            sorter: [
                {
                    $attr: {
                        system: {
                            name: 1,
                        }
                    },
                    $direction: 'asc',
                }
            ]
        }, context);
        console.log(applications);
    });

    it('[1.1]子查询', async () => {
        const store = new TreeStore<EntityDict, UniversalContext<EntityDict>>(storageSchema);
        const context = new UniversalContext(store);

        await store.operate('user', {
            action: 'create',
            data: {
                id: v4(),
                name: 'xc',
                nickname: 'xc',
            }
        }, context);

        /**
         * 这个子查询没有跨结点的表达式，所以应该可以提前计算子查询的值
         * 这个可以跟一下store.ts中translateAttribute函数里$in的分支代码
         * by Xc
         */
        const rows = await store.select('user', {
            data: {
                id: 1,
                name: 1,
                nickname: 1,
            },
            filter: {
                id: {
                    $in: {
                        entity: 'token',
                        data: {
                            userId: 1,
                        },
                        filter: {
                            entity: 'mobile',
                        }
                    },
                }
            },
        }, context);
        // console.log(rows);
        assert(rows.result.length === 0);
    });

    it('[1.2]行内属性上的表达式', async () => {
        const store = new TreeStore<EntityDict, UniversalContext<EntityDict>>(storageSchema);
        const context = new UniversalContext(store);

        await store.operate('user', {
            action: 'create',
            data: {
                id: v4(),
                name: 'xc',
                nickname: 'xc',
            }
        }, context);

        const users = await store.select('user', {
            data: {
                id: 1,
                name: 1,
                nickname: 1,
            },
            filter: {
                // '#id': 'node-123',
                $expr: {
                    $ne: [{
                        '#attr': 'name',
                    }, {
                        "#attr": 'nickname',
                    }]
                }
            },
        }, context);

        console.log(users);
    });

    it('[1.3]跨filter结点的表达式', async () => {
        const store = new TreeStore<EntityDict, UniversalContext<EntityDict>>(storageSchema);
        const context = new UniversalContext(store);

        await store.operate('application', {
            action: 'create',
            data: [{
                id: 'aaa',
                name: 'test',
                description: 'ttttt',
                type: 'web',
                system: {
                    action: 'create',
                    data: {
                        id: 'bbb',
                        name: 'systest',
                        description: 'aaaaa',
                        config: {},
                    }
                }
            }, {
                id: 'aaa2',
                name: 'test2',
                description: 'ttttt2',
                type: 'web',
                system: {
                    action: 'create',
                    data: {
                        id: 'ccc',
                        name: 'test2',
                        description: 'aaaaa2',
                        config: {},
                    }
                }
            }]
        }, context);

        const applications = await store.select('application', {
            data: {
                id: 1,
                name: 1,
                systemId: 1,
                system: {
                    id: 1,
                    name: 1,
                }
            },
            filter: {
                $expr: {
                    $startsWith: [
                        {
                            "#refAttr": 'name',
                            "#refId": 'node-1',
                        },
                        {
                            "#attr": 'name',
                        }
                    ]
                },
                system: {
                    "#id": 'node-1',
                }
            },
            sorter: [
                {
                    $attr: {
                        system: {
                            name: 1,
                        }
                    },
                    $direction: 'asc',
                }
            ]
        }, context);
        console.log(applications);
    });


    it('[1.4]跨filter子查询的表达式', async () => {
        const store = new TreeStore<EntityDict, UniversalContext<EntityDict>>(storageSchema);
        const context = new UniversalContext(store);

        await store.operate('application', {
            action: 'create',
            data: [{
                id: 'aaa',
                name: 'test',
                description: 'ttttt',
                type: 'web',
                system: {
                    action: 'create',
                    data: {
                        id: 'bbb',
                        name: 'systest',
                        description: 'aaaaa',
                        config: {},
                    }
                }
            }, {
                id: 'aaa2',
                name: 'test2',
                description: 'ttttt2',
                type: 'web',
                system: {
                    action: 'create',
                    data: {
                        id: 'ccc',
                        name: 'test2',
                        description: 'aaaaa2',
                        config: {},
                    }
                }
            }]
        }, context);

        let systems = await store.select('system', {
            data: {
                id: 1,
                name: 1,
            },
            filter: {
                "#id": 'node-1',
                id: {
                    $nin: {
                        entity: 'application',
                        data: {
                            systemId: 1,
                        },
                        filter: {
                            $expr: {
                                $eq: [
                                    {
                                        "#attr": 'name',
                                    },
                                    {
                                        '#refId': 'node-1',
                                        "#refAttr": 'name',
                                    }
                                ]
                            },
                            '#id': 'node-2',
                        }
                    },
                }
            },
            sorter: [
                {
                    $attr: {
                        name: 1,
                    },
                    $direction: 'asc',
                }
            ]
        }, context);
        assert(systems.result.length === 1 && systems.result[0].id === 'bbb');
        systems = await store.select('system', {
            data: {
                id: 1,
                name: 1,
            },
            filter: {
                "#id": 'node-1',
                id: {
                    $in: {
                        entity: 'application',
                        data: {
                            systemId: 1,
                        },
                        filter: {
                            $expr: {
                                $eq: [
                                    {
                                        "#attr": 'name',
                                    },
                                    {
                                        '#refId': 'node-1',
                                        "#refAttr": 'name',
                                    }
                                ]
                            },
                        }
                    },
                }
            },
            sorter: [
                {
                    $attr: {
                        name: 1,
                    },
                    $direction: 'asc',
                }
            ]
        }, context);
        assert(systems.result.length === 1 && systems.result[0].id === 'ccc');
    });

    it('[1.5]projection中的跨结点表达式', async () => {
        const store = new TreeStore<EntityDict, UniversalContext<EntityDict>>(storageSchema);
        const context = new UniversalContext(store);

        await store.operate('application', {
            action: 'create',
            data: [{
                id: 'aaa',
                name: 'test',
                description: 'ttttt',
                type: 'web',
                system: {
                    action: 'create',
                    data: {
                        id: 'bbb',
                        name: 'systest',
                        description: 'aaaaa',
                        config: {},
                    }
                }
            }, {
                id: 'aaa2',
                name: 'test2',
                description: 'ttttt2',
                type: 'web',
                system: {
                    action: 'create',
                    data: {
                        id: 'ccc',
                        name: 'test2',
                        description: 'aaaaa2',
                        config: {},
                    }
                }
            }]
        }, context);

        let applications = await store.select('application', {
            data: {
                "#id": 'node-1',
                id: 1,
                name: 1,
                system: {
                    id: 1,
                    name: 1,
                    $expr: {
                        $eq: [
                            {
                                "#attr": 'name',
                            },
                            {
                                '#refId': 'node-1',
                                "#refAttr": 'name',
                            }
                        ]
                    },
                }
            },
        }, context);
        // console.log(applications);
        assert(applications.result.length === 2);
        applications.result.forEach(
            (app) => {
                assert(app.id === 'aaa' && app.system!.$expr === false 
                    || app.id === 'aaa2' && app.system!.$expr === true);
            }
        );

        const applications2 = await store.select('application', {
            data: {
                $expr: {
                    $eq: [
                        {
                            "#attr": 'name',
                        },
                        {
                            '#refId': 'node-1',
                            "#refAttr": 'name',
                        }
                    ]
                },
                id: 1,
                name: 1,
                system: {
                    "#id": 'node-1',
                    id: 1,
                    name: 1,
                }
            },
        }, context);
        console.log(applications2);
        // assert(applications.length === 2);
        applications2.result.forEach(
            (app) => {
                assert(app.id === 'aaa' && app.$expr === false
                    || app.id === 'aaa2' && app.$expr === true);
            }
        );
    });

    it('[1.6]projection中的一对多跨结点表达式', async () => {
        const store = new TreeStore<EntityDict, UniversalContext<EntityDict>>(storageSchema);
        const context = new UniversalContext(store);

        await store.operate('system', {
            action: 'create',
            data: {
                id: 'bbb',
                name: 'test2',
                description: 'aaaaa',
                config: {},
                application$system: {
                    action: 'create',
                    data: [
                        {
                            id: 'aaa',
                            name: 'test',
                            description: 'ttttt',
                            type: 'web',
                        },
                        {

                            id: 'aaa2',
                            name: 'test2',
                            description: 'ttttt2',
                            type: 'weChatMp',
                        }
                    ]
                }
            }
        }, context);

        const systems = await store.select('system', {
            data: {
                "#id": 'node-1',
                id: 1,
                name: 1,
                application$system: {
                    data: {
                        id: 1,
                        name: 1,
                        $expr: {
                            $eq: [
                                {
                                    "#attr": 'name',
                                },
                                {
                                    '#refId': 'node-1',
                                    "#refAttr": 'name',
                                }
                            ]
                        },
                        $expr2: {
                            '#refId': 'node-1',
                            "#refAttr": 'id',
                        }
                    }
                },
            },
        }, context);
        // console.log(systems);
        assert(systems.result.length === 1);
        const [ system ] = systems.result;
        const { application$system: applications }  = system;
        assert(applications!.length === 2);
        applications!.forEach(
            (ele) => {
                assert(ele.id === 'aaa' && ele.$expr === false && ele.$expr2 === 'bbb'
                    || ele.id === 'aaa2' && ele.$expr === true && ele.$expr2 === 'bbb');
            }
        );
    });

    it('[1.7]事务性测试', async () => {
        const store = new TreeStore<EntityDict, UniversalContext<EntityDict>>(storageSchema);
        const context = new UniversalContext(store);

        await store.operate('system', {
            action: 'create',
            data: {
                id: 'bbb',
                name: 'test2',
                description: 'aaaaa',
                config: {},
                application$system: {
                    action: 'create',
                    data: [
                        {
                            id: 'aaa',
                            name: 'test',
                            description: 'ttttt',
                            type: 'web',
                        },
                        {

                            id: 'aaa2',
                            name: 'test2',
                            description: 'ttttt2',
                            type: 'weChatMp',
                        }
                    ]
                }
            }
        }, context);

        await context.begin();
        const systems = await store.select('system', {
            data: {
                id: 1,
                name: 1,
                application$system: {
                    data: {
                        id: 1,
                        name: 1,
                    }
                },
            },
        }, context);
        assert(systems.result.length === 1 && systems.result[0].application$system!.length === 2);
        
        await store.operate('application', {
            action: 'remove',
            data: {},
            filter: {
                id: 'aaa',
            }
        }, context);

        const systems2 = await store.select('system', {
            data: {
                id: 1,
                name: 1,
                application$system: {
                    data: {
                        id: 1,
                        name: 1,
                    }
                },
            },
        }, context);
        assert(systems2.result.length === 1 && systems2.result[0].application$system!.length === 1);
        await context.rollback();

        const systems3 = await store.select('system', {
            data: {
                id: 1,
                name: 1,
                application$system: {
                    data: {
                        id: 1,
                        name: 1,
                    }
                },
            },
        }, context);
        assert(systems3.result.length === 1 && systems3.result[0].application$system!.length === 2);
    });
});

