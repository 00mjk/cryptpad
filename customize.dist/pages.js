define([
    '/api/config',
    '/common/hyperscript.js',
    '/common/cryptpad-common.js',
    'jquery'
], function (Config, h, Cryptpad, $) {
    var Pages = {};
    var Msg = Cryptpad.Messages;
    var urlArgs = Config.requireConf.urlArgs;

    var setHTML = function (e, html) {
        e.innerHTML = html;
        return e;
    };

    var indexContent = function () {
        return [
            h('div.page.category.first#knowmore', [
                h('center', [
                    h('h1', Msg.main_howitworks)
                ])
            ]),
            h('div.page', [
                h('div.info-container', [
                    h('div.left.image', [
                        h('img', {
                            src: '/customize/images/zeroknowledge_small.png?' + urlArgs ,
                            alt: 'Zero Knowledge'
                        })
                    ]),
                    h('div.right', [
                        h('h2', Msg.main_zeroKnowledge),
                        setHTML(h('p'), Msg.main_zeroKnowledge_p)
                    ])
                ])
            ]),
            h('div.page.even', [
                h('div.info-container', [
                    h('div.left', [
                        h('h2', Msg.main_writeItDown),
                        h('p', Msg.main_writeItDown_p)
                    ]),
                    h('div.right.image', [
                        h('img', {
                            alt: "User account",
                            src: '/customize/images/realtime_small.png?' + urlArgs,
                        })
                    ])
                ])
            ]),
            h('div.page', [
                h('div.info-container', [
                    h('div.left.image', [
                        h('img', {
                            src: '/customize/images/key_small.png?' + urlArgs,
                            alt: 'User account'
                        })
                    ]),
                    h('div.right', [
                        h('h2', Msg.main_share),
                        h('p', Msg.main_share_p)
                    ])
                ])
            ]),
            h('div.page.even', [
                h('div.info-container', [
                    h('div.left', [
                        h('h2', Msg.main_organize),
                        h('p', Msg.main_organize_p)
                    ]),
                    h('div.right.image', [
                        h('img', {
                            src: '/customize/images/organize.png?' + urlArgs,
                            alt: 'User account'
                        })
                    ])
                ])
            ])
        ];
    };

    var footerCol = function (title, L, literal) {
        return h('div.col', [
            h('ul.list-unstyled', [
                h('li.title', {
                    'data-localization': title,
                }, title? Msg[title]: literal )
                ].concat(L.map(function (l) {
                    return h('li', [ l ]);
                }))
            )
        ]);
    };

    var footLink = function (ref, loc, text) {
        var attrs =  {
            href: ref,
        };
        if (!/^\//.test(ref)) {
            attrs.target = '_blank';
            attrs.rel = 'noopener noreferrer';
        }
        if (loc) {
            attrs['data-localization'] =  loc;
            text = Msg[loc];
        }
        return h('a', attrs, text);
    };

    var infopageFooter = function () {
        return h('footer', [
            h('div.container', [
                h('div.row', [
                    footerCol(null, [
                        footLink('/about.html', 'about'),
                        footLink('/terms.html', 'terms'),
                        footLink('/privacy.html', 'privacy'),
                    ], 'CryptPad'),
                    footerCol('footer_applications', [
                        footLink('/drive/', 'main_drive'),
                        footLink('/pad/', 'main_richText'),
                        footLink('/code/', 'main_code'),
                        footLink('/slide/', 'main_slide'),
                        footLink('/poll/', 'main_poll'),
                        footLink('/whiteboard/', null, Msg.type.whiteboard)
                    ]),
                    footerCol('footer_aboutUs', [
                        footLink('https://blog.cryptpad.fr', 'blog'),
                        footLink('https://labs.xwiki.com', null, 'XWiki Labs'),
                        footLink('http://www.xwiki.com', null, 'XWiki SAS'),
                        footLink('https://www.open-paas.org', null, 'OpenPaaS')
                    ]),
                    footerCol('footer_contact', [
                        footLink('https://riot.im/app/#/room/#cryptpad:matrix.org', null, 'Chat'),
                        footLink('https://twitter.com/cryptpad', null, 'Twitter'),
                        footLink('https://github.com/xwiki-labs/cryptpad', null, 'GitHub'),
                        footLink('/contact.html', null, 'Email')
                    ])
                ])
            ]),
            h('div.cp-version-footer', "CryptPad v1.13.0 (Naiad)")
        ]);
    };

    Pages['/about.html'] = function () {
        return h('div#cp-main.cp-page-about', [
            infopageTopbar(),
            h('div.container.cp-container', [
                h('center', [
                    h('h1', Msg.about)
                ]),
                setHTML(h('p'), Msg.main_p2),
                h('h2', Msg.main_howitworks),
                setHTML(h('p'), Msg.main_howitworks_p1)
            ].concat(indexContent())),
            infopageFooter()
        ]);
    };

    Pages['/privacy.html'] = function () {
        return h('div#cp-main.cp-page-privacy', [
            infopageTopbar(),
            h('div.container.cp-container', [
                h('center', h('h1', Msg.policy_title)),
                h('h2', Msg.policy_whatweknow),
                h('p', Msg.policywhatweknow_p1),

                h('h2', Msg.policy_howweuse),
                h('p', Msg.policy_howweuse_p1),
                h('p', Msg.policy_howweuse_p2),

                h('h2', Msg.policy_whatwetell),
                h('p', Msg.policy_whatwetell_p1),

                h('h2', Msg.policy_links),
                h('p', Msg.policy_links_p1),

                h('h2', Msg.policy_ads),
                h('p', Msg.policy_ads_p1),

                h('h2', Msg.policy_choices),
                h('p', Msg.policy_choices_open),
                setHTML(h('p'), Msg.policy_choices_vpn),
            ]),
            infopageFooter()
        ]);
    };

    Pages['/terms.html'] = function () {
        return h('div#cp-main.cp-page-terms', [
            infopageTopbar(),
            h('div.container.cp-container', [
                h('center', h('h1', Msg.tos_title)),
                h('p', Msg.tos_legal),
                h('p', Msg.tos_availability),
                h('p', Msg.tos_e2ee),
                h('p', Msg.tos_logs),
                h('p', Msg.tos_3rdparties),
            ]),
            infopageFooter()
        ]);
    };

    Pages['/contact.html'] = function () {
        return h('div#cp-main.cp-page-contact', [
            infopageTopbar(),
            h('div.container.cp-container', [
                h('center', h('h1', Msg.contact)),
                setHTML(h('p'), Msg.main_about_p2)
            ]),
            infopageFooter(),
        ]);
    };

    Pages['/what-is-cryptpad.html'] = function () {
        return h('div#cp-main.cp-page-what-is-cryptpad', [
            infopageTopbar(),
            h('div.container.cp-container', [
                h('center', h('h1', Msg.whatis_title)),
                setHTML(h('h2'), Msg.whatis_collaboration),
                setHTML(h('p'), Msg.whatis_collaboration_p1),
                setHTML(h('p'), Msg.whatis_collaboration_p2),
                setHTML(h('p'), Msg.whatis_collaboration_p3),
                setHTML(h('h2'), Msg.whatis_zeroknowledge),
                setHTML(h('p'), Msg.whatis_zeroknowledge_p1),
                setHTML(h('p'), Msg.whatis_zeroknowledge_p2),
                setHTML(h('p'), Msg.whatis_zeroknowledge_p3),
                setHTML(h('h2'), Msg.whatis_drive),
                setHTML(h('p'), Msg.whatis_drive_p1),
                setHTML(h('p'), Msg.whatis_drive_p2),
                setHTML(h('p'), Msg.whatis_drive_p3),
                setHTML(h('h2'), Msg.whatis_business),
                setHTML(h('p'), Msg.whatis_business_p1),
                setHTML(h('p'), Msg.whatis_business_p2),
            ]),
            infopageFooter(),
        ]);
    };

    var appButton = function (alt, h2, img, p, url, btn, id) {
        return h('div.app', [
            h('center', [
                h('h2', h2),
                h('img', {
                    alt: 'Rich Text application',
                    src: img,
                })
            ]),
            setHTML(h('p'), p),
            h('p.buttons', [
                h('a#' + id, {
                    href: url,
                }, [
                    h('button.btn.btn-secondary', btn),
                ])
            ])
        ]);
    };

    var infopageTopbar = function () {
        return h('div.cp-topbar',
            h('div.navbar.navbar-toggleable-sm.navbar-light.navbar-inverse',
            	h('button.navbar-toggler.navbar-toggler-left', {'type':'button'}, {'data-toggle':'collapse'}, {'data-target':'#menuCollapse'}, {'aria-controls': 'menuCollapse'}, {'aria-expanded':'false'}, {'aria-label':'Toggle navigation'},
            		[h('i.fa.fa-bars ')
            		]),
            	h('div.collapse.navbar-collapse#menuCollapse', [
                    h('ul.navbar-nav', [
                            h('a.cp-logo', { href: '/' }, [
                                h('img', { src: '/customize/cryptpad-new-logo-colors-logoonly.png?' + urlArgs })
                            ]),
                            h('li.nav-item', [
                                    h('a.nav-link', { href: '/what-is-cryptpad.html'}, Msg.topbar_whatIsCryptpad),
                                ]),
                            h('li.nav-item', [
                                    h('a.nav-link', { href: 'https://blog.cryptpad.fr/'}, Msg.blog),
                                ]),
                            h('li.nav-item', [
                                    h('a.nav-link', { href: '/contact.html'}, Msg.contact),
                                ]),
                            h('li.nav-item', [
                                    h('a.nav-link', { href: '/about.html'}, Msg.about),
                                ]),
                        ]),
            		]),
            ),
            h('div.cp-right',
                h('a.cp-register-btn', { href: '/register'}, Msg.login_register),
                h('a.cp-login-btn', { href: '/login'}, Msg.login_login)
            )
        );
    }

    Pages['/'] = Pages['/index.html'] = function () {
        var showingMore = false;
        return [
            h('div#cp-main.cp-page-index', [
                infopageTopbar(),
                h('div.container.cp-container', [
                    h('div.row', [
                        h('div.cp-title.col-12.col-sm-6', [
                            h('img', { src: '/customize/cryptpad-new-logo-colors-logoonly.png?' + urlArgs }),
                            h('h1', 'CryptPad'),
                            h('p', Msg.main_catch_phrase)
                        ]),
                        h('div.col-12.col-sm-6', [
                            [
                                [ 'pad', '/pad/', Msg.main_richTextPad, 'fa-file-word-o' ],
                                [ 'code', '/code/', Msg.main_codePad, 'fa-file-code-o' ],
                                [ 'slide', '/slide/', Msg.main_slidePad, 'fa-file-powerpoint-o' ],
                                [ 'poll.cp-more.cp-hidden', '/poll/', Msg.main_pollPad, 'fa-calendar' ],
                                [ 'whiteboard.cp-more.cp-hidden', '/whiteboard/', Msg.main_whiteboardPad, 'fa-paint-brush' ],
                                [ 'recent.cp-more.cp-hidden', '/drive/', Msg.main_recentPads, 'fa-hdd-o' ]
                            ].map(function (x) {
                                return h('a', [
                                    { href: x[1] },
                                    h('div.bs-callout.cp-callout-' + x[0], [
                                        h('i.fa.' + x[3]),
                                        h('div', [ h('h4', x[2]) ])
                                    ])
                                ]);
                            }),
                            h('div.bs-callout.cp-callout-more', [
                                h('div.cp-callout-more-lessmsg.cp-hidden', [
                                    "see less ",
                                    h('i.fa.fa-caret-up')
                                ]), 
                                h('div.cp-callout-more-moremsg', [
                                    "see more ",
                                    h('i.fa.fa-caret-down')
                                ]),
                                {
                                    onclick: function () {
                                        if (showingMore) {
                                            $('.cp-more, .cp-callout-more-lessmsg').addClass('cp-hidden');
                                            $('.cp-callout-more-moremsg').removeClass('cp-hidden');
                                        } else {
                                            $('.cp-more, .cp-callout-more-lessmsg').removeClass('cp-hidden');
                                            $('.cp-callout-more-moremsg').addClass('cp-hidden');
                                        }
                                        showingMore = !showingMore;
                                    }
                                }
                            ])
                        ])
                    ])
                ]),
            ])
        ];
    };

    var loadingScreen = function () {
        return h('div#loading', 
            h('div.loadingContainer', [
                h('img.cryptofist', {
                    src: '/customize/cryptofist_small.png?' + urlArgs
                }),
                h('div.spinnerContainer',
                    h('span.fa.fa-spinner.fa-pulse.fa-4x.fa-fw')),
                h('p', Msg.loading)
            ])
        );
    };
    loadingScreen = loadingScreen; // TODO use this

    Pages['/user/'] = Pages['/user/index.html'] = function () {
        return h('div#container');
    };

    Pages['/register/'] = Pages['/register/index.html'] = function () {
        return [h('div#cp-main.cp-page-register', [
            infopageTopbar(),
            h('div.container.cp-container', [
                h('div.row.align-items-center', [
                h('div#data.hidden.col-md-6', [
                    h('h1', Msg.register_header),
                    setHTML(h('p.register-explanation'), Msg.register_explanation)
                ]),
                h('div#userForm.form-group.hidden.col-md-6', [
                    h('input.form-control#username', {
                        type: 'text',
                        autocomplete: 'off',
                        autocorrect: 'off',
                        autocapitalize: 'off',
                        spellcheck: false,
                        placeholder: Msg.login_username,
                        autofocus: true,
                    }),
                    h('input.form-control#password', {
                        type: 'password',
                        placeholder: Msg.login_password,
                    }),
                    h('input.form-control#password-confirm', {
                        type: 'password',
                        placeholder: Msg.login_confirm,
                    }),
                    h('div.checkbox-container', [
                        h('input#import-recent', {
                            type: 'checkbox',
                            checked: true
                        }),
                        h('label', {
                            'for': 'import-recent',
                        }, Msg.register_importRecent),
                    ]),
                    h('div.checkbox-container', [
                        h('input#accept-terms', {
                            type: 'checkbox'
                        }),
                        setHTML(h('label', {
                            'for': 'accept-terms',
                        }), Msg.register_acceptTerms),
                    ]),
                    h('button#register.btn.btn-primary', Msg.login_register)
                ])
                ]),
            ]),
            infopageFooter(),
        ])];
    };

    Pages['/login/'] = Pages['/login/index.html'] = function () {
        return [h('div#cp-main.cp-page-login', [
            infopageTopbar(),
            h('div.container.cp-container', [
                h('div.row.align-items-center', [
                    h('div#data.hidden.col-md-6', setHTML(h('p.left'), Msg.main_info)),
                    h('div#userForm.form-group.hidden.col-md-6', [
                        h('input.form-control#name', {
                            name: 'name',
                            type: 'text',
                            autocomplete: 'off',
                            autocorrect: 'off',
                            autocapitalize: 'off',
                            spellcheck: false,
                            placeholder: Msg.login_username,
                            autofocus: true,
                        }),
                        h('input.form-control#password', {
                            type: 'password',
                            'name': 'password',
                            placeholder: Msg.login_password,
                        }),
                        h('div.extra', [
                            h('button.btn.btn-primary.login.first', Msg.login_login),
                            h('button#register.btn.btn-success.register', Msg.login_register)
                        ])
                    ])
                ]),
            ]),
            infopageFooter(),
        ])];
    };

    var appToolbar = function () {
        return h('div#toolbar.toolbar-container');
    };

    Pages['/whiteboard/'] = Pages['/whiteboard/index.html'] = function () {
        return [
            appToolbar(),
            h('div#canvas-area', h('canvas#canvas', {
                width: 600,
                height: 600
            })),
            h('div#controls', {
                style: {
                    display: 'block',
                }
            }, [
                h('button#clear', Msg.canvas_clear), ' ',
                h('button#toggleDraw', Msg.canvas_disable),
                h('button#delete', {
                    style: {
                        display: 'none',
                    }
                }),
                h('input#width', {
                    type: 'range',
                    value: "5",
                    min: "1",
                    max: "100"
                }),
                h('label', {
                    'for': 'width'
                }, Msg.canvas_width),
                h('input#opacity', {
                    type: 'range',
                    value: "1",
                    min: "0.1",
                    max: "1",
                    step: "0.1"
                }),
                h('label', {
                    'for': 'width',
                }),
                h('span.selected')
            ]),
            setHTML(h('div#colors'), '&nbsp;'),
            loadingScreen(),
            h('div#cursors', {
                style: {
                    display: 'none',
                    background: 'white',
                    'text-align': 'center',
                }
            }),
            h('div#pickers'),
        ];
    };

    Pages['/poll/'] = Pages['/poll/index.html'] = function () {
        return [
            appToolbar(),
            h('div#content', [
                h('div#poll', [
                    h('div#howItWorks', [
                        h('h1', 'CryptPoll'),
                        setHTML(h('h2'), Msg.poll_subtitle),
                        h('p', Msg.poll_p_save),
                        h('p', Msg.poll_p_encryption)
                    ]),
                    h('div.upper', [
                        h('button#publish', {
                            style: { display: 'none' }
                        }, Msg.poll_publish_button),
                        h('button#admin', {
                            style: { display: 'none' },
                            title: Msg.poll_admin_button
                        }, Msg.poll_admin_button),
                        h('button#help', {
                            title: Msg.poll_show_help_button,
                            style: { display: 'none' }
                        }, Msg.poll_show_help_button)
                    ]),
                    h('div.realtime', [
                        h('br'),
                        h('center', [
                            h('textarea#description', {
                                rows: "5",
                                cols: "50",
                                disabled: true
                            }),
                            h('br')
                        ]),
                        h('div#tableContainer', [
                            h('div#tableScroll'),
                            h('button#create-user', {
                                title: Msg.poll_create_user
                            }, h('span.fa.fa-plus')),
                            h('button#create-option', {
                                title: Msg.poll_create_option
                            }, h('span.fa.fa-plus')),
                            h('button#commit', {
                                title: Msg.poll_commit
                            }, h('span.fa.fa-check'))
                        ])
                    ])
                ])
            ]),
            loadingScreen()
        ];
    };

    Pages['/drive/'] = Pages['/drive/index.html'] = function () {
        return loadingScreen();
    };

    Pages['/file/'] = Pages['/file/index.html'] = function () {
        return loadingScreen();
    };

    Pages['/contacts/'] = Pages['/contacts/index.html'] = function () {
        return loadingScreen();
    };

    Pages['/pad/'] = Pages['/pad/index.html'] = function () {
        return loadingScreen();
    };

    Pages['/code/'] = Pages['/code/index.html'] = function () {
        return loadingScreen();
    };

    Pages['/slide/'] = Pages['/slide/index.html'] = function () {
        return loadingScreen();
    };

    Pages['/invite/'] = Pages['/invite/index.html'] = function () {
        return loadingScreen();
    };

    Pages['/settings/'] = Pages['/settings/index.html'] = function () {
        return [
            h('div#toolbar'),
            h('div#container'),
            loadingScreen()
        ];
    };

    Pages['/profile/'] = Pages['/profile/index.html'] = function () {
        return [
            h('div#toolbar'),
            h('div#container'),
            loadingScreen()
        ];
    };

    return Pages;
});
