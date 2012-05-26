(function() {

    var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    // Only on mainspace articles and mainspace talk pages
    if(mw.config.get('wgNamespaceNumber') > 1) {
        return;
    }
    var requires = [
        'jquery.ui.button',
        'jquery.ui.autocomplete',
        'jquery.ui.dialog',
        'mediawiki.api',
        '//en.wikipedia.org/w/index.php?title=User:YuviPanda/js-utils/underscore.js&action=raw&ctype=text/javascript',
        '//en.wikipedia.org/w/index.php?title=User:YuviPanda/js-utils/ClientTemplate.js&action=raw&ctype=text/javascript'
    ];

    var cssPath = '//en.wikipedia.org/w/index.php?title={{PREFIX}}/AssessmentBar.css&action=raw&ctype=text/css';

    // Loaded in externally
    var projectData = window.assBar.projectData; 

    function getArticleTitle(title) {
        // If in a talk page, returns original page title
        // Else returns title unmodified
        return title.replace(/^Talk:/i, "");
    }

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

    var extractorRegex =  new RegExp("{{(?:" + projectData.inputTemplates.join('|') + ")\\s*(?:\\s*\\|\\s*.*=?.*\\s*)*\\s*}}");

    var ass = null; // Current assessment

    var api = null; // API wrapper

    var templates = null; // ClientTemplate instance

    function Assessment(project, data, rawText, title) {
        this.project = project;
        this.data = data;
        this.rawText = rawText;
        this.title = title
    }

    Assessment.prototype.toTemplate = function() {
        var template;
        var curDate = new Date();
        var dateString = MONTH_NAMES[curDate.getMonth()] + " " + curDate.getUTCFullYear();
        this.data['assess-date'] = dateString;
        template = "{{" + projectData.outputTemplate;
        $.each(this.data, function(key, value) {
            template += "|" + key + "=" + value;
        });
        template += "}}";
        return template;
    }

    Assessment.prototype.getDisplayData = function() {
        // Defaults in case they don't exist
        var displayData = {
            importance: "unassessed",
            'class': "unassessed"
        };
        $.each(this.data, function(key, value) {
            if(key === 'importance' || key === 'class') {
                if(!$.trim(value)) {
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
            if($.inArray(key.replace(/-importance$/, ''), projectData.subProjects) != -1 && value != "" && !subProjects[key]) {
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

    Assessment.prototype.removeSubProject = function(subProject) {
        delete this.data[subProject];
        delete this.data[subProject + "-importance"];
    }
    Assessment.prototype.addSubProject = function(subProject, importance) {
        this.data[subProject] = "yes";
        this.data[subProject + "-importance"] = importance;
    }
    Assessment.prototype.save = function() {
        var d = $.Deferred();
        // Kill 'auto' fields
        delete this.data['auto'];

        var text = this.rawText.replace(extractorRegex, this.toTemplate());

        api.post({
            action: 'edit',
            title: 'Talk:' + this.title,
            summary: 'Changed assessment status for ' + projectData.name + ' (via [[User:YuviPanda/AssessmentBar|AssessmentBar]])',
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
                if(mw.config.get('wgPageName').match(/^Talk/)) {
                    location.reload(true); // Hard refresh
                }
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

        $("#assbar-new-subproject-name").autocomplete({
            source: projectData.subProjects,
            autoFocus: true
        });

        $("#assbar-add-new-subproject").click(function() {
            $("#assbar-new-subproject-dialog").dialog({
                modal: true,
                title: "Add new Sub Project",
                buttons: {
                    "Add": function() {
                        var subProject = $("#assbar-new-subproject-name").val();
                        var importance = $("#assbar-new-subproject-importance").val();
                        if($.inArray(subProject, projectData.subProjects) === -1) {
                            alert("Invalid subproject chosen!");
                            return;
                        }
                        ass.addSubProject(subProject, importance.replace("unassessed", ""));

                        var dialog = this;
                        templates.getTemplate('NewSubProject').done(function(template) {
                            var displayData = {
                                project: projectData,
                                subProject: subProject,
                                importance: importance
                            };
                            $(template(displayData)).appendTo("#assbar-subprojects-list");
                            $(dialog).dialog("close");
                        });
                    }
                }
            });
            return false;
        });

        $(".assbar-subproject-delete").click(function() {
            var subProject = $(this).parents(".assbar-item").attr('data-project');
            var sure = confirm("Do you want to delete the sub project " + subProject + "?");
            if(sure) {
                ass.removeSubProject(subProject);
                $(this).parents(".assbar-item").fadeOut();
            }
            return false;
        });

    }

    mw.loader.load(cssPath, 'text/css');
    loadScripts(requires).done(function() {
            api = new mw.Api();
            templates = new ClientTemplate('{{PREFIX}}');
            $(function() {

                var title = getArticleTitle(mw.config.get('wgPageName'));
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
                                data: ass.getDisplayData()
                            };
                            $(template(displayAss)).appendTo("body");
                            bindAssBarEvents();
                        });
                    }
                });

            });
    });
})();
