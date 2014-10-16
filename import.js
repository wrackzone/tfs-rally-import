// Node TFS Rally Import Barry Mullan 2014

var config = require('./config.json');

var csv = require('ya-csv');
var fs = require("fs");
var _ = require('lodash');
var async = require('async');

var rally = require('rally'),
	refUtils = rally.util.ref,
 	queryUtils = rally.util.query;

var restApi = rally(config);
var users = [];
var projects = [];
var workspace = null;
var parentFeature = null;
var parentStory = null;

var readAllProjects = function(callback) {

	restApi.query({
	    type: 'project', //the type to query
	    start: 1, //the 1-based start index, defaults to 1
	    pageSize: 200, //the page size (1-200, defaults to 200)
	    limit: 'Infinity', //the maximum number of results to return- enables auto paging
	    // order: 'Rank', //how to sort the results
	    fetch: ['Name', 'ObjectID', 'Parent', 'State'], //the fields to retrieve
	    query: queryUtils.where('State', '=', "Open"), //optional filter
	    scope: {
	        workspace: workspace._ref, // '/workspace/1234' //specify to query entire workspace
	        // project: '/project/2345' //specify to query a specific project
	        up: false, //true to include parent project results, false otherwise
	        down: true //true to include child project results, false otherwise
	    },
	    requestOptions: {} //optional additional options to pass through to request
	}, function(error, result) {
	    if(error) {
	        console.log("Error",error);
	        callback(error,result);
	    } else {
	        // console.log(result.Results);
	        callback(null,result);
	    }
	});

}

var readAllUsers = function(callback) {

	restApi.query({
	    type: 'user', //the type to query
	    start: 1, //the 1-based start index, defaults to 1
	    pageSize: 200, //the page size (1-200, defaults to 200)
	    limit: 'Infinity', //the maximum number of results to return- enables auto paging
	    // order: 'Rank', //how to sort the results
	    fetch: ['UserName', 'ObjectID', 'FirstName', 'LastName'], //the fields to retrieve
	    query: queryUtils.where('UserName', '!=', "foo"), //optional filter
	    scope: {
	        workspace: workspace._ref, // '/workspace/1234' //specify to query entire workspace
	        // project: '/project/2345' //specify to query a specific project
	        up: false, //true to include parent project results, false otherwise
	        down: true //true to include child project results, false otherwise
	    },
	    requestOptions: {} //optional additional options to pass through to request
	}, function(error, result) {
	    if(error) {
	        console.log("Error",error);
	        callback(error,result);
	    } else {
	        // console.log(result.Results);
	        callback(null,result);
	    }
	});
}

var readAllIterations = function(callback) {

	restApi.query({
	    type: 'iteration', //the type to query
	    start: 1, //the 1-based start index, defaults to 1
	    pageSize: 200, //the page size (1-200, defaults to 200)
	    limit: 'Infinity', //the maximum number of results to return- enables auto paging
	    // order: 'Rank', //how to sort the results
	    fetch: ['ObjectID', 'Project', 'Name'], //the fields to retrieve
	    // query: queryUtils.where('UserName', '!=', "foo"), //optional filter
	    scope: {
	        workspace: workspace._ref, // '/workspace/1234' //specify to query entire workspace
	        // project: '/project/2345' //specify to query a specific project
	        up: false, //true to include parent project results, false otherwise
	        down: true //true to include child project results, false otherwise
	    },
	    requestOptions: {} //optional additional options to pass through to request
	}, function(error, result) {
	    if(error) {
	        console.log("Error",error);
	        callback(error,result);
	    } else {
	        // console.log(result.Results);
	        callback(null,result);
	    }
	});
}

var readWorkspaceRef = function(workspaceName,callback) {

	restApi.query({
	    type: 'workspace', //the type to query
	    start: 1, //the 1-based start index, defaults to 1
	    pageSize: 200, //the page size (1-200, defaults to 200)
	    limit: 'Infinity', //the maximum number of results to return- enables auto paging
	    // order: 'Rank', //how to sort the results
	    fetch: ['Name', 'ObjectID'], //the fields to retrieve
	    // query: queryUtils.where('ObjectID', '!=', 0), //optional filter
	}, function(error, result) {
	    if(error) {
	        console.log("Error",error);
	        callback(error,null);
	    } else {
	    	console.log("ws results",result);
			var workspace = _.find(result.Results,function(r) {
	        	return r.Name === workspaceName;
	        });
	        callback(null,workspace)
	    }
	});

}

var readCsvFile = function( filename, callback) {

	fs.exists(filename, function (exists) {
		var that = this;
	  	if (exists) {
			var reader = csv.createCsvFileReader(filename);
			var header = [];
			var records = [];

			reader.addListener('data',function(record) {
				if (header.length === 0)
					header = record;
				else {
					var obj = {};
					_.each(header,function(key,x){
						obj[key] = record[x];
					})
					records.push(obj);
				}
				// console.log(record[0]);
			});

			reader.addListener('end',function(){
				callback(records);
			});
		}
	});
};

var isTask = function(artifact) {
	return artifact.type === "task";
};
var isFeature = function(artifact) {
	return artifact.type === "portfolioitem/feature";
}
var isStory = function(artifact) {
	return artifact.type === "hierarchicalrequirement";	
}

var processor = function(records) {


	async.eachSeries( records, function(record,callback) {

		var last = process(record);
		// console.log("last",last);

		var rallyObj = restApi.create({
			type : last.type,
			data : last.data,
			fetch : last.fetch,
			// scope : 
		}, function(error,result) {
				if (error) {
					console.log("error",error);
				} else {
					console.log(result.Object.FormattedID);
					if (isFeature(last)) {
						parentFeature = result.Object._ref;
					} else if (isStory(last)) {
						parentStory = result.Object._ref
					}
					callback();
				}
			}
		);

		

	});


};

var selector = {

	selectType : function(type) {
		switch (type) {
			case "Feature":
				return "portfolioitem/feature"; break;
			case "User Story": 
				return "hierarchicalrequirement"; break;
			case "Task":
				return "task"; break;
			case "Bug":
				return "defect"; break;
			case "Test Case":
				return "testcase"; break;
			case "Issue":
				return "defect"; break;
		}
		return null;
	},

	selectName : function(record) {
		for(i = 1; i <= 4; i++) {
			var title = "Title " + i;
			if ( record[title] !== "")
				return record[title];
		};
		return null;
	},

	selectProject : function(record) {
		var project = _.last( record["Area Path"].split("\\"));
		return project;
	},

	selectIteration : function(record) {
		var iteration = _.last( record["Iteration Path"].split("\\"));
		return iteration;
	},

	selectOwner : function(record) {
		var owner = record["Assigned To"];
		return owner;
	},

	getOwner : function(record) {
		var o = this.selectOwner(record);

		if (o==="")
			return null;

		var lastName = o.split(",")[0].trim();
		var firstName = o.split(",")[1].trim();
		return _.find( users, function(u) {
			return u.LastName === lastName && u.FirstName === firstName;
		});
	},

	getProject : function(record) {
		var p = this.selectProject(record);
		return _.find( projects, function(project) {
			return project.Name === p;
		});
	},

	topLevel : function(record) {
		return (record["Title 1"] !== "")
	}

};

var process = function(record) {


	var artifact = {
		type : selector.selectType(record["Work Item Type"]),
		fetch : ["FormattedID","ObjectID","_ref"],
		data : {
			Name : selector.selectName(record),
			Owner : selector.getOwner(record),
			Project : selector.getProject(record),
			Notes : record["ID"]
		}
	};

	if (isTask(artifact)) {
		artifact.data.WorkProduct = parentStory;
	} else if (isStory(artifact)) {
		if (!selector.topLevel(record)) {
			artifact.data.PortfolioItem = parentFeature;
		}
	}

	// appendValues(artifact,record);
	return artifact
};

var validate = function(filename,callback) {

	readCsvFile(filename,function(records) {

		var vprojects = [],
			vusers = []

		_.each(records,function(record) {
			var pName = selector.selectProject(record);
			var o = selector.selectOwner(record);
			var lastName = (o !== "") ? o.split(",")[0].trim() : "";
			var firstName = (o !== "") ? o.split(",")[1].trim() : "";
			if (_.isUndefined( _.find( projects, function(p) {
				return p.Name === pName;
			}))) {
				vprojects.push(p);
			}
			if (o!=="" && _.isUndefined( _.find(users,function(u) {
				return u["LastName"] === lastName && u["FirstName"] === firstName
			}))) {
				vusers.push(o);
			}
		});

		if (vprojects.length > 0 || vusers.length > 0) {
			callback({error:{projects:_.uniq(vprojects),users:_.uniq(vusers)}},null);
		} else {
			callback(null,null);
		}
	});
}

var filename = "test.csv";

readWorkspaceRef(config.workspace,function(err,ws) {
	workspace = ws;
	async.series( [readAllUsers,readAllProjects,readAllIterations], function(err,result) {
		console.log(result.length);
		_.each(result,function(r) {console.log(r.Results.length);});

		users      = result[0].Results;
		projects   = result[1].Results;
		iterations = result[2].Results;

		validate(filename,function(error,result) {

			if (error!==null) {
				console.log(error.error.projects.length,error.error.users.length,error);
			} else {
				console.log("ready to run!");
				readCsvFile(filename,processor);
			}
		});


	})

});



