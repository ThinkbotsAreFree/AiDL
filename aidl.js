

// Debug helpers
function log(x) { document.write(JSON.stringify(x,null,4)+'\n'); }





// Whole AiDL

var l = {};



// Various special values

l.nothing = Symbol();
l.exe_running = Symbol();
l.exe_success = Symbol();
l.exe_failure = Symbol();



// schemeNumber & biginteger

function SNumber(value) {
	
	var result = SchemeNumber(value);
	
	var keys = Object.keys(result);
	
	for (var k=0; k<keys.length; k++) {
		
		this[keys[k]] = result[keys[k]];
	}
}

number = function(value) { return new SNumber(value); }



// Values repository

l.mem = {};



// Unique identifier incrementing generator (no max limit)
// modified from https://stackoverflow.com/questions/11295066/how-to-increment-a-numeric-string-by-1-with-javascript-jquery

l.newId = (function(){
	var current = "0";

	var addOne = function(s) {
		
		let newNumber = '';
		let continueAdding = true;
		
		for (let i = s.length - 1; i>= 0; i--) {
			
			if (continueAdding) {
				
				let num = parseInt(s[i], 10) + 1;
				
				if (num < 10) {
					
					newNumber += num;
					continueAdding = false;
					
				} else {
					
					newNumber += '0';
					if (i==0) newNumber += '1';
				}
				
			} else {  
			
				newNumber +=s[i];
			}
		}
		
		return newNumber.split("").reverse().join("");
	}	
	
	return function() {
		
		current = addOne(current);
		return "#"+current;
	};
})();



// Javascript Prototype: value container

l.container = function (value) {
	
	for (var v=0; v<value.length; v++) {
		
		this["slot:"+value[v].slot] = {};
		
		var keys = Object.keys(value[v]);
		
		for (var k=0; k<keys.length; k++)
			if (keys[k] != "slot")
				this["slot:"+value[v].slot][keys[k]] = value[v][keys[k]];
	}
}



// Javascript Prototype: AiDL function

l.Aidlfunc = function (source) {
	
	this.source = source;
}



// Create a new value container, with a fresh memory id

l.newValue = function(value,memLocation) {
	
	var where = (memLocation || l.newId());
	
	l.mem[where] = new l.container(value);
	
	return where;
}



// Create a new Boolean

l.newBoolean = function(label,value,memLocation) {
	
	var where = l.newValue([
		{ slot: "label", type: "String", content: label },
		{ slot: "prototype", type: "List", content: [l.ref_Boolean] },
		{ slot: "value", type: "Boolean", content: (value?true:false) },
	],memLocation);
	
	return where;
}



// Create a new Number

l.newNumber = function(label,value,memLocation) {
	
	var where = l.newValue([
		{ slot: "label", type: "String", content: label },
		{ slot: "prototype", type: "List", content: [l.ref_Number] },
		{ slot: "value", type: "Number", content: number(value) },
	],memLocation);
	
	return where;
}



// Create a new String

l.newString = function(label,value,memLocation) {
	
	var where = l.newValue([
		{ slot: "label", type: "String", content: label },
		{ slot: "prototype", type: "List", content: [l.ref_String] },
		{ slot: "value", type: "String", content: value },
	],memLocation);
	
	return where;
}



// Create a new Reference

l.newReference = function(label,value,memLocation) {
	
	var where = l.newValue([
		{ slot: "label", type: "String", content: label },
		{ slot: "prototype", type: "List", content: [l.ref_Reference] },
		{ slot: "value", type: "Reference", content: value },
	],memLocation);
	
	return where;
}



// Create a new List

l.newList = function(label,value,memLocation) {
	
	var where = l.newValue([
		{ slot: "label", type: "String", content: label },
		{ slot: "prototype", type: "List", content: [l.ref_List] },
		{ slot: "value", type: "List", content: value },
	],memLocation);
	
	return where;
}



// Create a new Function

l.newFunction = function(label,value,memLocation) {

	var parsed = sourceParser.parse(value);
	
	var where = l.newValue([
		{ slot: "label", type: "String", content: label },
		{ slot: "prototype", type: "List", content: [l.ref_Function] },
		{ slot: "value", type: "Function",
			content: l.convertJS2AiDL('',parsed),	// objects of source
			parsedSource: parsed,					// JSON of source
			rawSource: value }						// source string
	],memLocation);
	
	return where;
}



// Get type, with correct arrays and schemeNumbers

l.getType = function(data) {
	
	var dataType = Object.prototype.toString.call(data);
	dataType = dataType.substring(8,dataType.length-1);
	if (data instanceof SNumber) dataType = "Number";
	if (data instanceof l.Aidlfunc) dataType = "Function";
	return dataType;
}



// Convert Javascript data to new AiDL data

l.convertJS2AiDL = function(label,data,memLocation,proto) {
	
	var dataType = l.getType(data);
	
	var where;
	
	switch (dataType) {
		
		case "Boolean":
		
			where = l.newBoolean(label,data,memLocation);
			break;
			
		case "Number":
		
			where = l.newNumber(label,data,memLocation);
			break;
			
		case "String":
		
			where = l.newString(label,data,memLocation);
			break;
			
		case "Array":
		
			var list = [];
		
			for (var k=0; k<data.length; k++)
				list.push(l.convertJS2AiDL('',data[k]));
			
			where = l.newList(label,list,memLocation);
			break;
			
		case "Object":
		
			var keys = Object.keys(data);
			
			var slotList = [ { slot: "label", type: "String", content: label } ];
			
			if (!data["prototype"])
				slotList.push({ slot: "prototype", type: "List", content: (proto || [l.ref_Object]) });
			
			for (var k=0; k<keys.length; k++)
				slotList.push({
					slot: keys[k],
					type: "Reference",
					freeToo: (keys[k] != "prototype"),
					content: (keys[k] == "prototype" ?
						data[keys[k]] :
						l.convertJS2AiDL(keys[k],data[keys[k]]))
				});
			
			where = l.newValue(slotList,memLocation);
			break;
			
		case "Function":
		
			where = l.newFunction(label,data.source,memLocation);
			break;
	}
	
	return where;
}



// Free a memory location

l.freeMem = function(id) {
	
	var keys = Object.keys(l.mem[id]);
		
	for (var k=0; k<keys.length; k++) {
		
		if (l.mem[id][keys[k]].freeToo)
			l.freeMem(l.mem[id][keys[k]].content);
		
		if (keys[k] != "slot:prototype")
			if ((l.mem[id][keys[k]].type == "List")
				|| (l.mem[id][keys[k]].type == "Function"))
				for (var i=0; i<l.mem[id][keys[k]].content.length; i++)
					l.freeMem(l.mem[id][keys[k]].content[i]);
	}
	
	delete l.mem[id];
}



// Update value in a memory location

l.updateMem = function(id,newData,label,proto) {
	
	if (!l.mem[id]) return;
	
	if (label) l.mem[id]["slot:label"] = {
		type: "String",
		content: label
	};
	
	l.freeMem(id);
	
	l.convertJS2AiDL(label,newData,id,proto);
}



// Base references

l.ref_Space     = "#1";
l.ref_Boolean   = "#2";
l.ref_Number    = "#3";
l.ref_String    = "#4";
l.ref_Reference = "#5";
l.ref_List      = "#6";
l.ref_Object    = "#7";
l.ref_Function  = "#8";
l.ref_Execution = "#9";
l.ref_Native    = "#10";



// #1
// The "Space" object

l.newValue([

	{ slot: "label", type: "String", content: "Space" },
	{ slot: "prototype", type: "List", content: [l.ref_Object] },
	
	{ slot: "Boolean",   type: "Reference", content: l.ref_Boolean },
	{ slot: "Number",    type: "Reference", content: l.ref_Number },
	{ slot: "String",    type: "Reference", content: l.ref_String },
	{ slot: "Reference", type: "Reference", content: l.ref_Reference },
	{ slot: "List",      type: "Reference", content: l.ref_List },
	{ slot: "Object",    type: "Reference", content: l.ref_Object },
	{ slot: "Function",  type: "Reference", content: l.ref_Function },
	{ slot: "Execution", type: "Reference", content: l.ref_Execution },
	{ slot: "Native",    type: "Reference", content: l.ref_Native }
	
]);



// #2
// The "Boolean" object

l.newValue([
	{ slot: "label", type: "String", content: "Boolean" },
	{ slot: "prototype", type: "List", content: [l.ref_Object] },
]);



// #3
// The "Number" object

l.newValue([
	{ slot: "label", type: "String", content: "Number" },
	{ slot: "prototype", type: "List", content: [l.ref_Object] },
]);



// #4
// The "String" object

l.newValue([
	{ slot: "label", type: "String", content: "String" },
	{ slot: "prototype", type: "List", content: [l.ref_Object] },
]);



// #5
// The "Reference" object

l.newValue([
	{ slot: "label", type: "String", content: "Reference" },
	{ slot: "prototype", type: "List", content: [l.ref_Object] },
]);



// #6
// The "List" object

l.newValue([
	{ slot: "label", type: "String", content: "List" },
	{ slot: "prototype", type: "List", content: [l.ref_Object] },
]);



// #7
// The "Object" object

l.newValue([
	{ slot: "label", type: "String", content: "Object" },
]);



// #8
// The "Function" object

l.newValue([
	{ slot: "label", type: "String", content: "Function" },
	{ slot: "prototype", type: "List", content: [l.ref_Object] },
]);



// #9
// The "Execution" object

l.newValue([
	{ slot: "label", type: "String", content: "Execution" },
	{ slot: "prototype", type: "List", content: [l.ref_Object] },
]);



// #10
// The "Native" object

l.newValue([
	{ slot: "label", type: "String", content: "Native" },
	{ slot: "prototype", type: "List", content: [l.ref_Object] },
]);



// #11
// The "set" native function

l.newValue([
	{ slot: "label", type: "String", content: "set" },
	{ slot: "prototype", type: "List", content: [l.ref_Native] },
	{ slot: "value", type: "Native", content: l.nat_set }
]);



// Native "set" function definition

l.nat_set = function(argument,context) {
	
	
}



// Create or update a slot of the specified host object, with a JS value

l.setSlot = function(host,slotName,value,proto) {

	if (!l.mem[host]) alert("Warning: setting a slotVal in empty memId "+host);
	
	if (l.mem[host]["slot:"+slotName]) {

		l.updateMem(l.mem[host]["slot:"+slotName].content,value,slotName,proto);
	
	} else {
		
		l.mem[host]["slot:"+slotName] = {
			type: "Reference",
			content: l.convertJS2AiDL(slotName,value,undefined,proto)
		};
	}
}



// Delete a slot of the specified host object

l.delSlot = function(host,slotName) {
	
	if (!l.mem[host]) alert("Warning: deleting a slot in empty memId "+host);
	
	if (l.mem[host]["slot:"+slotName]) {

		l.freeMem(l.mem[host]["slot:"+slotName].content);
	
		delete l.mem[host]["slot:"+slotName];
	}
}



// Get reference of a slot in a host

l.getSlot = function(host,slotName) {

	if (l.mem[host]["slot:"+slotName].type == "Reference")
		
		return l.mem[host]["slot:"+slotName].content;
		
	else
		
		alert("Warning, getting non-reference slot in host "+host);
}



// Javascript Prototype: execution context

l.execution = function (host,funcSlot) {
	
	this.host = host;
	this.funcSlot = funcSlot;
	
	this.functionObject = l.mem[host]["slot:"+funcSlot].content;
	
	this.parsedSource = l.mem[this.functionObject]["slot:value"].parsedSource;
	
	this.receiver = host;
	
	this.currentCodeline = [];
	
	this.currentCodepart = [];
	
	this.currentItem = [];
};



l.execution.prototype.step = function() {
	
	var outcome = { state: "nothing yet" };

	while ((outcome.state != "source is empty")
		&& (outcome.state != "new item is available")) {

		outcome = this.getNextItem();
	}
	
	if (outcome.state == "source is empty") return { state: "execution success" };
	
	switch (this.currentItem.type) {
		
		case "RawString":
		case "CurlyBraces":
			outcome = this.treatConstant();
			break;
		
		case "SingleQuoteString":
		case "DoubleQuoteString":
		case "Parentheses":
			outcome = this.treatModifyable();
			break;
			
		case "SquareBrackets":
			outcome = this.treatEmbedded();
			break;
			
		Default:
			alert("Warning: currentItem type error - "+this.currentItem.type);
	}
	
	return outcome;
}



l.execution.prototype.treatConstant = function() {
	
	var lookup = this.lookup(this.receiver,this.currentItem.content);
	
	if (lookup.outcome == "success") {
		
		this.receiver = lookup.found;
		return { state: "running" };
		
	} else {

		// here, we should raise an exception
		return { state: "running" };
	}
}



l.execution.prototype.treatModifyable = function() { // we'll need a different parser here
	
	return { state: "running" };
}



l.execution.prototype.treatEmbedded = function() {
	
	return { state: "running" };
}



l.execution.prototype.getNextItem = function() {

	if (this.currentCodepart.length == 0) { // get the next code part
	
		if (this.currentCodeline.length == 0) { // get the next code line

			if (this.parsedSource.length == 0)
				return { state: "source is empty" };
		
			this.currentCodeline = this.parsedSource.shift().part;
			
			this.receiver = this.host;
			
			return { state: "new code line is available" };
		}
	
		this.currentCodepart = this.currentCodeline.shift().item;
		
		return { state: "new code part is available" };
	}
	
	this.currentItem = this.currentCodepart.shift();
	
	return { state: "new item is available" };
}



l.execution.prototype.lookup = function(receiver,slotName) {

	if (l.mem[receiver]["slot:"+slotName]) {
		
		if (l.mem[receiver]["slot:"+slotName].type == "Reference") {
			
			return { outcome: "success", found: l.getSlot(receiver,slotName) };
		}
		
		alert("Warning: lookup failure 1");
		
	} else {
			
		if (l.mem[receiver]["slot:prototype"]) {
			
			var result = { outcome: "running" };
			var protoIterator = 0;
			
			while (result.outcome == "running") {
			
				result = this.lookup(l.mem[receiver]["slot:prototype"].content[protoIterator],slotName);
				
				protoIterator++;
				
				if ((result.outcome != "success")
					&& (protoIterator < l.mem[receiver]["slot:prototype"].content.length))
					result = { outcome: "running" };
			}
			
			return result;
		}
		
		return { outcome: "no prototype found" };
	}
}



var source = new l.Aidlfunc(`

	maxy {mother} description;
`);



l.setSlot("#1","Animal",{
	purpose: "run around"
});



l.setSlot("#1","Dog",{
	description: "Nice edible animal",
	"prototype": [l.getSlot("#1","Animal")]
});



l.setSlot("#1","Stupid",{
	foo: "bar"
});



l.setSlot("#1","maxy",{
	father: {
		name: "unknown doggy",
		age: 5,
		"prototype": [l.getSlot("#1","Dog")]
	},
	mother: {
		name: "unknown dogget",
		age: 4,
		"prototype": [l.getSlot("#1","Dog")]
	}
},[l.getSlot("#1","Dog"),l.getSlot("#1","Stupid")]);



l.setSlot("#1","MAINSOURCE",source);





var exe = new l.execution("#1","MAINSOURCE");

while (exe.step().state != "execution success")
	log(l.mem[exe.receiver]["slot:label"].content);




log(l.mem);













