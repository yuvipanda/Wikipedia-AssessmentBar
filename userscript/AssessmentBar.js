/* page: User:Yuvipanda/AssessmentBar.js */
(function() {

    // Only on mainspace articles
    if(mw.config.get('wgNamespaceNumber') != 0) {
        return;
    }
    var requires = [
        'jquery.ui.button',
        'jquery.ui.dialog',
        'mediawiki.api',
        '//en.wikipedia.org/w/index.php?title=User:Yuvipanda/js-utils/underscore.js&action=raw&ctype=text/javascript',
        '//en.wikipedia.org/w/index.php?title=User:Yuvipanda/js-utils/ClientTemplate.js&action=raw&ctype=text/javascript'
    ];

    var cssPath = '//en.wikipedia.org/w/index.php?title=User:Yuvipanda/AssessmentBar.css&action=raw&ctype=text/css';

    var projectData = {
        name: 'WP India',
        inputTemplates: ['WP India', 'WikiProject India'],
        outputTemplate: 'WP India',
        subProjects: [
                'andaman',
                'andhra',
                'arunachal',
                'assam',
                'bihar',
                'chandigarh',
                'chhattisgarh',
                'dadra',
                'daman',
                'delhi',
                'goa',
                'gujarat',
                'haryana',
                'himachal',
                'jandk',
                'jharkhand',
                'karnataka',
                'kerala',
                'lakshya',
                'madhya',
                'maharashtra',
                'manipur',
                'meghalaya',
                'mizoram',
                'nagaland',
                'odisha',
                'puducherry',
                'punjab',
                'rajasthan',
                'sikkim',
                'tamilnadu',
                'tripura',
                'uttar',
                'uttarakand',
                'bengal',
                'mumbai',
                'mangalore',
                'chennai',
                'hyderabad',
                'geography',
                'states',
                'districts',
                'cities',
                'maps',
                'history',
                'literature',
                'politics',
                'language',
                'cinema',
                'music',
                'television',
                'education',
                'history',
                'tamil'
            ],
        actionNeeded: [
            'orphan',
            'needs-infobox',
            'map-needed',
            'image-needed',
            'attention'
        ],
        importanceOptions: [
            'top', 'high', 'mid', 'low', 'unassessed'
        ],
        classOptions: [
            'stub', 'start', 'c', 'b', 'ga', 'a', 'fa', 'unassessed'
        ]
    };
    

    function loadScripts(scripts) {
        var deferreds = [];
        $.each(scripts, function(i, script) {
            if(script.match(/^(http:|https:|\/\/)/)) {
                // External script, use $.getScript
                deferreds.push($.getScript(script));
            } else {
                // Use mw.using, convert callbacks to deferreds
                var d = $.Deferred();
                mw.loader.using(script, function() {
                    d.resolve();
                }, function(err) {
                    d.reject(err);
                });
                deferreds.push(d);
            }
        });
        return $.when.apply($, deferreds);
    }

    var extractorRegex =  new RegExp("{{(?:" + projectData.inputTemplates.join('|') + ")\\s*(?:\\s*\\|\\s*.*=.*\\s*)*\\s*}}");

    var ass = null; // Current assessment

    var api = null; // API wrapper

    function Assessment(project, data, rawText, title) {
        this.project = project;
        this.data = data;
        this.rawText = rawText;
        this.title = title
    }

    Assessment.prototype.toTemplate = function() {
        var template;
        template = "{{" + projectData.outputTemplate;
        $.each(this.data, function(key, value) {
            template += "|" + key + "=" + value;
        });
        template += "}}";
        return template;
    }

    Assessment.prototype.getDisplayData = function() {
        var displayData = {};
        $.each(this.data, function(key, value) {
            if(key === 'importance' || key === 'class') {
                if($.trim(value) === "") {
                    value = 'unassessed';
                }
            }
            if(value === 'yes' || value === 'y') {
                value = 'unassessed';
            }
            displayData[key] = value;
        });
        return displayData;
    }

    Assessment.prototype.getSubProjects = function() {
        var subProjects = {};
        $.each(this.data, function(key, value) {
            if(value.match(/y(es)?/i)) {
                value = "unassessed";
            }
            if($.inArray(key, projectData.subProjects) != -1) {
                subProjects[key] = "";
            }
            if($.inArray(key.replace(/-importance$/, ''), projectData.subProjects) != -1) {
                subProjects[key.replace(/-importance$/, '')] = value;
            }
        });
        return subProjects;
    }

    Assessment.prototype.getActionItems = function() {
        var actionItems = {};
        var that = this;
        $.each(projectData.actionNeeded, function(i, action) {
            actionItems[action] = (that.data[action] === "yes");
        });
        return actionItems;
    }

    Assessment.prototype.save = function() {
        var d = $.Deferred();
        var text = this.rawText.replace(extractorRegex, this.toTemplate());

        api.post({
            action: 'edit',
            title: 'Talk:' + this.title,
            summary: 'Change assessment status for ' + projectData.name + ' (via AssessmentBar)',
            text: text,
            token: mw.user.tokens.get('editToken')
        }, {
            ok: function(data) {
                d.resolve(data);
                console.log('Success!');
            }
        });
        return d;
    }

    Assessment.fromWikiText = function(text, title) {
        var match = text.match(extractorRegex);
        if(match === null) {
            return null;
        }
        var cleanTemplate = match[0].replace(/{|}|\n/g, '');
        var parts = cleanTemplate.split('|');
        var tags = {};
        for(var i = 1; i < parts.length; i++) {
            console.log(parts[i]);
            var tag = parts[i].split('=');
            tags[$.trim(tag[0])] = $.trim(tag[1]).toLowerCase();
        }
        return new Assessment(parts[0], tags, text, title);
    }

    function bindAssBarEvents() {
        $("#assbar-save").click(function() {
            var that = this;
            $(that).text("Saving...");
            ass.save().done(function() {
                $(that).text("Save");
            });
            return false;
        });

        $(".assbar-action-item").change(function() {
            var action = $(this).parents(".assbar-item").attr('data-action');
            if($(this).is(':checked')) {
                ass.data[action] = 'yes';
            } else {
                delete ass.data[action];
            }
        });

        $(".assbar-importance, .assbar-class").change(function() {
            var project = $(this).parents(".assbar-item").attr('data-project');
            var value = $(this).val().replace("unassessed", "");
            if(project == projectData.name) {
                // Main Project 
                var what = $(this).hasClass("assbar-importance") ? "importance" : "class";
                ass.data[what] = value; 
            } else {
                // One of the sub projects
                ass.data[project] = "yes";
                ass.data[project + "-importance"] = value;
            }
        });
    }

    mw.loader.load(cssPath, 'text/css');
    loadScripts(requires).done(function() {
            api = new mw.Api();
            var templates = new ClientTemplate('User:Yuvipanda/AssessmentBar');
            $(function() {

                var title = mw.config.get('wgPageName');
                api.get({
                    action: "parse",
                    page: 'Talk:' +  title,
                    prop: 'wikitext'
                }, {
                    ok: function(data) {
                        ass = Assessment.fromWikiText(data.parse.wikitext['*'], title);
                        if(!ass) {
                            return;
                        }
                        a = ass;
                        templates.getTemplate('Toolbar').done(function(template) {
                            var displayAss = {
                                project: projectData,
                                subProjects: ass.getSubProjects(),
                                actionItems: ass.getActionItems(),
                                data: ass.getDisplayData(),
                            };
                            $(template(displayAss)).appendTo("body");
                            bindAssBarEvents();
                        });
                    }
                });

            });
    });
})();
