import { v4 } from 'uuid';
import { describe, it } from 'mocha';
import { EntityDict, storageSchema } from 'oak-domain/lib/base-app-domain';
import { generateNewId } from 'oak-domain/lib/utils/uuid';
import assert from 'assert';
import TreeStore from '../src/store';
import { FrontendRuntimeContext, FrontendStore } from './Context';

describe('基础测试', function () {
    this.timeout(1000000);

    it('[1.0]简单查询', () => {
        const store = new FrontendStore(storageSchema);
        const context = new FrontendRuntimeContext(store);
        context.begin();
        const created = store.operate('modiEntity', {
            id: generateNewId(),
            action: 'create',
            data: [{
                id: generateNewId(),
                entity: 'user',
                entityId: 'user-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user',
                        entityId: 'user-id-1',
                        action: 'create',
                        data: {},
                    }
                }
            }, {
                id: generateNewId(),
                entity: 'user',
                entityId: 'user-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user',
                        entityId: 'user-id-1',
                        action: 'update',
                        data: {},
                    }
                }
            }]
        }, context, {});

        // console.log(created);

        const modiEntities = store.select('modiEntity', {
            data: {
                id: 1,
                entity: 1,
                entityId: 1,
                modi: {
                    id: 1,
                    targetEntity: 1,
                    entity: 1,
                    entityId: 1,
                    action: 1,
                    data: 1,
                }
            },
            sorter: [
                {
                    $attr: {
                        modi: {
                            id: 1,
                        }
                    },
                    $direction: 'asc',
                }
            ]
        }, context, {});
        // console.log(modiEntities);

        context.commit();
    });

    it('[1.1]子查询', () => {
        const store = new FrontendStore(storageSchema);
        const context = new FrontendRuntimeContext(store);
        context.begin();

        const created = store.operate('modiEntity', {
            id: generateNewId(),
            action: 'create',
            data: [{
                id: generateNewId(),
                entity: 'user',
                entityId: 'user-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user',
                        entityId: 'user-id-1',
                        action: 'create',
                        data: {},
                    }
                }
            }, {
                id: generateNewId(),
                entity: 'user',
                entityId: 'user-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user',
                        entityId: 'user-id-1',
                        action: 'update',
                        data: {},
                    }
                }
            }]
        }, context, {});

        /**
         * 这个子查询没有跨结点的表达式，所以应该可以提前计算子查询的值
         * 这个可以跟一下store.ts中translateFilter函数里子查询的分支代码
         * by Xc
         */
        const rows = store.select('modi', {
            data: {
                id: 1,
                targetEntity: 1,
                entity: 1,
            },
            filter: {
                modiEntity$modi: {
                    entity: 'user',
                    entityId: 'user-id-1',
                }
            },
        }, context, {});
        // console.log(rows);
        assert(rows.length === 2);
        context.commit();
    });

    it('[1.2]行内属性上的表达式', () => {
        const store = new FrontendStore(storageSchema);
        const context = new FrontendRuntimeContext(store);
        context.begin();

        const created = store.operate('modiEntity', {
            id: generateNewId(),
            action: 'create',
            data: [{
                id: generateNewId(),
                entity: 'user-id-1',
                entityId: 'user-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user',
                        entityId: 'user-id-1',
                        action: 'create',
                        data: {},
                    }
                }
            }, {
                id: generateNewId(),
                entity: 'user',
                entityId: 'user-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user',
                        entityId: 'user-id-1',
                        action: 'update',
                        data: {},
                    }
                }
            }]
        }, context, {});

        const modiEntities = store.select('modiEntity', {
            data: {
                id: 1,
                entity: 1,
                entityId: 1,
            },
            filter: {
                // '#id': 'node-123',
                $expr: {
                    $ne: [{
                        '#attr': 'entity',
                    }, {
                        "#attr": 'entityId',
                    }]
                }
            },
        }, context, {});

        //  console.log(modiEntities);
        assert(modiEntities.length === 1);
        context.commit();
    });

    it('[1.3]跨filter结点的表达式', () => {
        const store = new FrontendStore(storageSchema);
        const context = new FrontendRuntimeContext(store);
        context.begin();

        const created = store.operate('modiEntity', {
            id: generateNewId(),
            action: 'create',
            data: [{
                id: generateNewId(),
                entity: 'user',
                entityId: 'user-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user',
                        entityId: 'user-id-1',
                        action: 'create',
                        data: {},
                    }
                }
            }, {
                id: generateNewId(),
                entity: 'user3',
                entityId: 'user3-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user2',
                        entityId: 'user2-id-1',
                        action: 'update',
                        data: {},
                    }
                }
            }]
        }, context, {});


        const applications = store.select('modiEntity', {
            data: {
                id: 1,
                entity: 1,
                entityId: 1,
            },
            filter: {
                $expr: {
                    $startsWith: [
                        {
                            "#refAttr": 'entityId',
                            "#refId": 'node-1',
                        },
                        {
                            "#attr": 'entity',
                        }
                    ]
                },
                modi: {
                    "#id": 'node-1',
                }
            },
            sorter: [
                {
                    $attr: {
                        modi: {
                            entity: 1,
                        }
                    },
                    $direction: 'asc',
                }
            ]
        }, context, {});
        // console.log(applications);
        assert(applications.length === 1);

        context.commit();
    });


    it('[1.4]跨filter子查询的表达式', () => {
        const store = new FrontendStore(storageSchema);
        const context = new FrontendRuntimeContext(store);
        context.begin();

        const created = store.operate('modiEntity', {
            id: generateNewId(),
            action: 'create',
            data: [{
                id: generateNewId(),
                entity: 'user',
                entityId: 'user-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user',
                        entityId: 'user-id-1',
                        action: 'create',
                        data: {},
                    }
                }
            }, {
                id: generateNewId(),
                entity: 'user3',
                entityId: 'user3-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user2',
                        entityId: 'user2-id-1',
                        action: 'update',
                        data: {},
                    }
                }
            }]
        }, context, {});

        let modies = store.select('modi', {
            data: {
                id: 1,
                targetEntity: 1,
            },
            filter: {
                "#id": 'node-1',
                modiEntity$modi: {
                    $expr: {
                        $eq: [
                            {
                                "#attr": 'entity',
                            },
                            {
                                '#refId': 'node-1',
                                "#refAttr": 'entity',
                            }
                        ]
                    },
                    '#id': 'node-2',
                    '#sqp': 'not in',
                }
            },
            sorter: [
                {
                    $attr: {
                        entity: 1,
                    },
                    $direction: 'asc',
                }
            ]
        }, context, {});
        assert(modies.length === 1);
        // console.log(modies);
        context.commit();
    });

    it('[1.5]projection中的跨结点表达式', () => {
        const store = new FrontendStore(storageSchema);
        const context = new FrontendRuntimeContext(store);
        context.begin();

        const created = store.operate('modiEntity', {
            id: generateNewId(),
            action: 'create',
            data: [{
                id: generateNewId(),
                entity: 'user',
                entityId: 'user-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user',
                        entityId: 'user-id-1',
                        action: 'create',
                        data: {},
                    }
                }
            }, {
                id: generateNewId(),
                entity: 'user3',
                entityId: 'user3-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user2',
                        entityId: 'user2-id-1',
                        action: 'update',
                        data: {},
                    }
                }
            }]
        }, context, {});

        let modiEntities = store.select('modiEntity', {
            data: {
                "#id": 'node-1',
                id: 1,
                entity: 1,
                modi: {
                    id: 1,
                    $expr: {
                        $eq: [
                            {
                                "#attr": 'entity',
                            },
                            {
                                '#refId': 'node-1',
                                "#refAttr": 'entity',
                            }
                        ]
                    },
                }
            },
        }, context, {});
        // console.log(modiEntities);
        assert(modiEntities.length === 2);
        modiEntities.forEach(
            (me) => {
                assert(me.entity === 'user' && me?.modi?.$expr === true ||
                    me.entity === 'user3' && me?.modi?.$expr === false);
            }
        )

        const modiEntities2 = store.select('modiEntity', {
            data: {
                $expr: {
                    $eq: [
                        {
                            "#attr": 'entity',
                        },
                        {
                            '#refId': 'node-1',
                            "#refAttr": 'entity',
                        }
                    ]
                },
                id: 1,
                entity: 1,
                modi: {
                    "#id": 'node-1',
                    id: 1,
                    targetEntity: 1,
                    entity: 1,
                }
            },
        }, context, {});
        // console.log(modiEntities2);
        assert(modiEntities2.length === 2);
        modiEntities2.forEach(
            (me) => assert(me.entity === 'user' && me.$expr === true ||
                me.entity === 'user3' && me.$expr === false)
        );
        context.commit();
    });

    it('[1.6]projection中的一对多跨结点表达式', () => {
        const store = new FrontendStore(storageSchema);
        const context = new FrontendRuntimeContext(store);
        context.begin();

        const created = store.operate('modiEntity', {
            id: generateNewId(),
            action: 'create',
            data: [{
                id: generateNewId(),
                entity: 'user',
                entityId: 'user-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user',
                        entityId: 'user-id-1',
                        action: 'create',
                        data: {},
                    }
                }
            }]
        }, context, {});

        const modies = store.select('modi', {
            data: {
                "#id": 'node-1',
                id: 1,
                targetEntity: 1,
                entity: 1,
                modiEntity$modi: {
                    $entity: 'modiEntity',
                    data: {
                        id: 1,
                        entity: 1,
                        // modiId: 1,
                        $expr: {
                            $eq: [
                                {
                                    "#attr": 'entity',
                                },
                                {
                                    '#refId': 'node-1',
                                    "#refAttr": 'entity',
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
        }, context, {});
        // console.log(JSON.stringify(modies));
        assert(modies.length === 1);
        const [modi] = modies;
        const { modiEntity$modi: modiEntities } = modi;
        assert(modiEntities!.length === 1 && modiEntities![0]?.$expr === true && modiEntities![0]?.$expr2 === modi.id);
        context.commit();
    });

    it('[1.7]事务性测试', () => {
        const store = new FrontendStore(storageSchema);
        const context = new FrontendRuntimeContext(store);
        context.begin();

        const created = store.operate('modiEntity', {
            id: generateNewId(),
            action: 'create',
            data: [{
                id: generateNewId(),
                entity: 'user',
                entityId: 'user-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user',
                        entityId: 'user-id-1',
                        action: 'create',
                        data: {},
                    }
                }
            }, {
                id: generateNewId(),
                entity: 'user3',
                entityId: 'user3-id-1',
                modi: {
                    action: 'create',
                    data: {
                        id: generateNewId(),
                        targetEntity: 'ddd',
                        entity: 'user2',
                        entityId: 'user2-id-1',
                        action: 'update',
                        data: {},
                    }
                }
            }]
        }, context, {});
        context.commit();

        context.begin();
        const modies = store.select('modi', {
            data: {
                id: 1,
                entity: 1,
                modiEntity$modi: {
                    $entity: 'modiEntity',
                    data: {
                        id: 1,
                        entity: 1,
                        modiId: 1,
                    }
                },
            },
        }, context, {});
        assert(modies.length === 2 && modies[0].modiEntity$modi!.length === 1);

        store.operate('modiEntity', {
            id: generateNewId(),
            action: 'remove',
            data: {},
            filter: {
                modiId: modies[0]!.id,
            }
        }, context, {});

        const me2 = store.select('modiEntity', {
            data: {
                id: 1,
                entity: 1,
            },
        }, context, {});
        assert(me2.length === 1 && !me2.find(ele => !!ele.$$deleteAt$$));
        context.rollback();

        context.begin();

        const me3 = store.select('modiEntity', {
            data: {
                id: 1,
                entity: 1,
            },
        }, context, {});
        assert(me3.length === 2 && !me3.find(ele => !!ele.$$deleteAt$$));

        context.commit();
    });

    it('[1.8]aggregate', () => {
        const store = new FrontendStore(storageSchema);
        const context = new FrontendRuntimeContext(store);
        context.begin();
        store.operate('modi', {
            id: generateNewId(),
            action: 'create',
            data: [{
                id: generateNewId(),
                targetEntity: 'ddd',
                entity: 'user',
                entityId: 'user-id-1',
                action: 'create',
                data: {},
                modiEntity$modi: {
                    action: 'create',
                    data: [{
                        id: generateNewId(),
                        entity: 'user',
                        entityId: 'user-id-1',
                    }, {
                        id: generateNewId(),
                        entity: 'user',
                        entityId: 'user-id-1',
                    }, {
                        id: generateNewId(),
                        entity: 'user',
                        entityId: 'user-id-1',
                    }, {
                        id: generateNewId(),
                        entity: 'user',
                        entityId: 'user-id-1',
                    }]
                }
            }, {
                id: generateNewId(),
                targetEntity: 'ddd2',
                entity: 'user',
                entityId: 'user-id-2',
                action: 'create',
                data: {},
                modiEntity$modi: {
                    action: 'create',
                    data: [
                        {
                            id: generateNewId(),
                            entity: 'user',
                            entityId: 'user-id-2',
                        },
                        {
                            id: generateNewId(),
                            entity: 'user',
                            entityId: 'user-id-2',
                        },
                        {
                            id: generateNewId(),
                            entity: 'user',
                            entityId: 'user-id-2',
                        }
                    ],
                },
            }],
        }, context, {});
        context.commit();

        context.begin();
        const result = store.aggregate('modiEntity', {
            data: {
                '#count-1': {
                    id: 1,
                },
                '#avg-1': {
                    $$createAt$$: 1,
                },
                '#aggr': {
                    modi: {
                        targetEntity: 1,
                    }
                }
            },
        }, context, {});
        console.log(result);
        context.commit();
    });

    it('[1.9]selection+aggregate', () => {
        const store = new FrontendStore(storageSchema);
        const context = new FrontendRuntimeContext(store);
        context.begin();
        store.operate('modi', {
            id: generateNewId(),
            action: 'create',
            data: [{
                id: generateNewId(),
                targetEntity: 'ddd',
                entity: 'user',
                entityId: 'user-id-1',
                action: 'create',
                data: {},
                modiEntity$modi: {
                    action: 'create',
                    data: [{
                        id: generateNewId(),
                        entity: 'user',
                        entityId: 'user-id-1',
                    }, {
                        id: generateNewId(),
                        entity: 'user',
                        entityId: 'user-id-1',
                    }, {
                        id: generateNewId(),
                        entity: 'user',
                        entityId: 'user-id-1',
                    }, {
                        id: generateNewId(),
                        entity: 'user',
                        entityId: 'user-id-1',
                    }]
                }
            }, {
                id: generateNewId(),
                targetEntity: 'ddd2',
                entity: 'user',
                entityId: 'user-id-2',
                action: 'create',
                data: {},
                modiEntity$modi: {
                    action: 'create',
                    data: [
                        {
                            id: generateNewId(),
                            entity: 'user',
                            entityId: 'user-id-2',
                        },
                        {
                            id: generateNewId(),
                            entity: 'user',
                            entityId: 'user-id-2',
                        },
                        {
                            id: generateNewId(),
                            entity: 'user',
                            entityId: 'user-id-2',
                        }
                    ],
                },
            }],
        }, context, {});
        context.commit();

        context.begin();
        const result = store.select('modi', {
            data: {
                id: 1,
                modiEntity$modi$$aggr: {
                    $entity: 'modiEntity',
                    data: {
                        '#count-1': {
                            id: 1,
                        },
                        '#avg-1': {
                            $$createAt$$: 1,
                        },
                        '#aggr': {
                            modi: {
                                targetEntity: 1,
                            }
                        }
                    },
                    filter: {
                        entity: 'user',
                    },
                }
            }
        }, context, {});
        console.log(result);
        context.commit();
    });

    it('[1.10]select json', () => {
        const store = new FrontendStore(storageSchema);
        const context = new FrontendRuntimeContext(store);
        context.begin();
        const id = generateNewId();
        store.operate('oper', {
            id: generateNewId(),
            action: 'create',
            data: {
                id,
                action: 'test',
                data: {
                    name: 'xc',
                    books: [{
                        title: 'mathmatics',
                        price: 1,
                    }, {
                        title: 'english',
                        price: 2,
                    }]
                },
                targetEntity: 'bbb',
            }
        }, context, {});

        const row = store.select('oper', {
            data: {
                id: 1,
                data: {
                    name: 1,
                    books: [undefined, {
                        title: 1,
                        price: 1,
                    }],
                },
            },
        }, context, {});

        context.commit();
        console.log(JSON.stringify(row));
    });


    it('[1.11]json as filter', () => {
        const store = new FrontendStore(storageSchema);
        const context = new FrontendRuntimeContext(store);
        context.begin();

        const id = generateNewId();
        store.operate('oper', {
            id: generateNewId(),
            action: 'create',
            data: {
                id,
                action: 'test',
                data: {
                    name: 'xc',
                    books: [{
                        title: 'mathmatics',
                        price: 1,
                    }, {
                        title: 'english',
                        price: 2,
                    }]
                },
                targetEntity: 'bbb',
            }
        }, context, {});

        const row = store.select('oper', {
            data: {
                id: 1,
                data: {
                    name: 1,
                    books: [undefined, {
                        title: 1,
                        price: 1,
                    }],
                },
            },
            filter: {
                data: {
                    name: 'xc',
                }
            }
        }, context, {});
        const row2 = store.select('oper', {
            data: {
                id: 1,
                data: {
                    name: 1,
                    books: [undefined, {
                        title: 1,
                        price: 1,
                    }],
                },
            },
            filter: {
                data: {
                    name: 'xc2',
                }
            }
        }, context, {});

        context.commit();
        // console.log(JSON.stringify(row));
        assert (row.length === 1);
        assert (row2.length === 0);
    });

    it('[1.12]complicated json filter', () => {
        const store = new FrontendStore(storageSchema);
        const context = new FrontendRuntimeContext(store);
        context.begin();

        const id = generateNewId();
        store.operate('oper', {
            id: generateNewId(),
            action: 'create',
            data: {
                id,
                action: 'test',
                data: {
                    name: 'xc',
                    price: [100, 400, 1000],
                },
                targetEntity: 'bbb',
            }
        }, context, {});

        const row = store.select('oper', {
            data: {
                id: 1,
                data: {
                    name: 1,
                    price: 1,
                },
            },
            filter: {
                id,
                data: {
                    price: [undefined, 400],
                }
            }
        }, context, {});

        const row2 = store.select('oper', {
            data: {
                id: 1,
                data: {
                    name: 1,
                    price: 1,
                },
            },
            filter: {
                id,
                data: {
                    price: [undefined, 200],
                }
            }
        }, context, {});

        const row3 = store.select('oper', {
            data: {
                id: 1,
                data: {
                    name: 1,
                    price: 1,
                },
            },
            filter: {
                id,
                data: {
                    price: [undefined, {
                        $gt: 300,
                    }],
                }
            }
        }, context, {});

        const row4 = store.select('oper', {
            data: {
                id: 1,
                data: {
                    name: 1,
                    price: 1,
                },
            },
            filter: {
                id,
                data: {
                    price: {
                        $contains: [200, 500],
                    },
                }
            }
        }, context, {});

        const row5 = store.select('oper', {
            data: {
                id: 1,
                data: {
                    name: 1,
                    price: 1,
                },
            },
            filter: {
                id,
                data: {
                    price: {
                        $contains: [100, 400],
                    },
                }
            }
        }, context, {});

        const row6 = store.select('oper', {
            data: {
                id: 1,
                data: {
                    name: 1,
                    price: 1,
                },
            },
            filter: {
                id,
                data: {
                    price: {
                        $contains: ['xc'],
                    },
                }
            }
        }, context, {});

        const row7 = store.select('oper', {
            data: {
                id: 1,
                data: {
                    name: 1,
                    price: 1,
                },
            },
            filter: {
                id,
                data: {
                    name: {
                        $includes: 'xc',
                    },
                    price: {
                        $overlaps: [200, 400, 800],
                    },
                }
            }
        }, context, {});

        context.commit();
        assert(row.length === 1);
        assert(row2.length === 0);
        assert(row3.length === 1);
        assert(row4.length === 0);
        assert(row5.length === 1);
        assert(row6.length === 0);
        assert(row7.length === 1);
        // console.log(JSON.stringify(row7));
    });
});

